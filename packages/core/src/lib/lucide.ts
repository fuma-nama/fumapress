import path from "node:path";
import { parseSync, type ParseResult, type Plugin } from "vite";

type StaticImport = ParseResult["module"]["staticImports"][number];

/** an export of a barrel file, declared by another module */
export interface BarrelExport {
  /** absolute path of the declaring module */
  file: string;
  /** name of the export in the declaring module */
  name: string;
}

const identifierRe = /^[A-Za-z_$][\w$]*$/;

/**
 * Dev-only: rewrite named imports from the `lucide-react` barrel into imports of the modules declaring them.
 *
 * Vite doesn't tree-shake in dev, and nothing pre-bundles `lucide-react` here, so importing a single icon loads all ~1,900 modules of the barrel, once per environment:
 *
 * - client: it's imported by framework packages excluded from the optimizer (e.g. `fumadocs-ui`), and Vite doesn't discover dependencies imported from `node_modules`.
 * - rsc/ssr: `@vitejs/plugin-rsc` excludes packages with a React peer dependency, its `"use client"` modules must stay separate modules.
 *
 * It's excluded from the client optimizer too: app code would otherwise get a pre-bundled copy, duplicating the `"use client"` modules that server components reference by file path.
 */
export function lucideImports(): Plugin {
  const barrels = new Map<string, Promise<Map<string, BarrelExport>>>();

  return {
    name: "fumapress:lucide-react",
    apply: "serve",
    // after other transforms (e.g. MDX), before Vite's import analysis
    enforce: "post",
    configEnvironment(name) {
      if (name === "client") return { optimizeDeps: { exclude: ["lucide-react"] } };
    },
    transform: {
      filter: { code: /["']lucide-react["']/ },
      async handler(code, id) {
        // the import records alone, without deserializing the AST
        const { module, errors } = parseSync(id, code, { lang: "js", sourceType: "module" });
        if (errors.length > 0) return;
        const imports = module.staticImports.filter(
          (statement) => statement.moduleRequest.value === "lucide-react",
        );
        if (imports.length === 0) return;

        // per importer, packages may depend on different copies
        const barrel = await this.resolve("lucide-react", id);
        if (!barrel || barrel.external) return;
        // pre-bundled anyway, e.g. listed in `optimizeDeps.include`
        if (
          this.environment.mode === "dev" &&
          this.environment.depsOptimizer?.isOptimizedDepFile(barrel.id)
        )
          return;

        const file = barrel.id.replace(/\?.*$/, "");
        let exports = barrels.get(file);
        if (!exports) {
          exports = this.fs
            .readFile(file, { encoding: "utf8" })
            .then((source) => getBarrelExports(file, source))
            // not a barrel we can read, keep the imports
            .catch(() => new Map());
          barrels.set(file, exports);
        }

        const out = rewriteImports(code, imports, await exports);
        // line numbers are kept, so the module's sourcemap still applies
        if (out !== undefined) return { code: out, map: null };
      },
    },
  };
}

/**
 * Map the names a barrel file re-exports, like `export { default as X } from "./icons/x.mjs"`, to the modules declaring them.
 */
export function getBarrelExports(file: string, code: string): Map<string, BarrelExport> {
  const exports = new Map<string, BarrelExport>();
  const dir = path.posix.dirname(file);

  for (const { entries } of parseSync(file, code).module.staticExports) {
    for (const { moduleRequest, importName, exportName } of entries) {
      // namespaces and local exports (e.g. lucide's `icons`) aren't declared by a single module
      if (
        !moduleRequest?.value.startsWith(".") ||
        importName.kind !== "Name" ||
        exportName.kind !== "Name" ||
        !identifierRe.test(importName.name!)
      )
        continue;

      exports.set(exportName.name!, {
        file: path.posix.join(dir, moduleRequest.value),
        name: importName.name!,
      });
    }
  }

  return exports;
}

/**
 * Replace import statements of named exports from a barrel with imports of the modules declaring them, keeping line numbers. Statements importing anything else (e.g. a namespace) are kept as-is.
 *
 * @returns `undefined` if nothing changed
 */
export function rewriteImports(
  code: string,
  imports: StaticImport[],
  exports: Map<string, BarrelExport>,
): string | undefined {
  let out = "";
  let last = 0;

  for (const { start, end, entries } of imports) {
    const statements: string[] = [];
    for (const { importName, localName } of entries) {
      const target = importName.kind === "Name" ? exports.get(importName.name!) : undefined;
      if (!target) break;

      const source = JSON.stringify(target.file);
      statements.push(
        target.name === "default"
          ? `import ${localName.value} from ${source};`
          : `import { ${target.name} as ${localName.value} } from ${source};`,
      );
    }
    // side-effect imports have no entries
    if (entries.length === 0 || statements.length < entries.length) continue;

    const lines = code.slice(start, end).split("\n").length;
    out += code.slice(last, start) + statements.join(" ") + "\n".repeat(lines - 1);
    last = end;
  }

  if (last > 0) return out + code.slice(last);
}
