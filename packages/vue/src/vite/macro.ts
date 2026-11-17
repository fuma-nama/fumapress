import { glob } from "node:fs/promises";
import path from "node:path";
import { normalizePath, parseAst } from "vite";
import { MagicString } from "vue/compiler-sfc";
import { lastCommitDates } from "./git";

/**
 * The macros of `@fumapress/vue/content`, as `fumadocs-mdx/macro` compiles its own: a call is read without running
 * the module, and becomes the creation of its collection from `import.meta.glob` imports of its files.
 */
const MACRO_MODULE = "@fumapress/vue/content";

type MacroName = "defineDocs" | "defineCollections";

interface Node {
  type: string;
  start: number;
  end: number;
  [key: string]: any;
}

/** a collection as its macro call declares it, from the options that are literals */
export interface MacroCollection {
  /** its folder, from the project root */
  dir: string;
  /** patterns of its pages from `dir`, none for a collection of `meta.json` files */
  pages?: string[];
  /** patterns of its `meta.json` files from `dir`, none for a collection of pages */
  meta?: string[];
  lastModified: boolean;
}

interface MacroCall {
  node: Node;
  options?: Node;
  collection: MacroCollection;
}

const DEFAULT_DIR = "content/docs";
const DEFAULT_PAGES = ["**/*.{md,mdx}"];
const DEFAULT_META = ["**/meta{,.*}.json"];
/** a file or folder starting with `_` holds what pages import, like a partial: it is in no collection */
const HIDDEN = ["!**/_*", "!**/_*/**"];

function errorAt(file: string, code: string, offset: number, message: string): Error {
  const lines = code.slice(0, offset).split("\n");
  const column = lines.at(-1)!.length + 1;
  return new Error(`[Fumapress] ${file}:${lines.length}:${column}: ${message}`);
}

const isNode = (value: unknown): value is Node =>
  typeof value === "object" && value !== null && typeof (value as Node).type === "string";

/** keys of nodes that are never a reference to a value: types, and names that are not variables */
const SKIPPED_KEYS = new Set([
  "typeAnnotation",
  "returnType",
  "typeArguments",
  "typeParameters",
  "label",
  "exported",
]);

/** calls `visit` for each identifier that refers to a variable */
function walkReferences(node: Node, visit: (node: Node) => void) {
  if (node.type === "ImportDeclaration") return;
  if (node.type === "Identifier") return visit(node);
  for (const [key, value] of Object.entries(node)) {
    if (SKIPPED_KEYS.has(key)) continue;
    // `a.name` and `{ name: a }`: the name of a property, not a variable
    if (key === "property" && node.type === "MemberExpression" && !node.computed) continue;
    if (key === "key" && !node.computed) continue;
    for (const child of [value].flat()) if (isNode(child)) walkReferences(child, visit);
  }
}

function propertyKey(property: Node): string | undefined {
  if (property.type !== "Property" || property.kind !== "init" || property.computed) return;
  const key = property.key as Node;
  if (key.type === "Identifier") return key.name;
  if (key.type === "Literal" && typeof key.value === "string") return key.value;
}

/** the value of a literal, of a list of them, or none */
function staticValue(node: Node): { value: unknown } | undefined {
  if (node.type === "Literal" && !node.regex) return { value: node.value };
  if (node.type === "TemplateLiteral" && node.expressions.length === 0) {
    return { value: node.quasis[0]?.value.cooked ?? "" };
  }
  if (node.type === "ArrayExpression") {
    const items = (node.elements as (Node | null)[]).map((item) =>
      item && item.type !== "SpreadElement" ? staticValue(item) : undefined,
    );
    if (items.every((item) => item !== undefined))
      return { value: items.map((item) => item.value) };
  }
}

const isString = (value: unknown): value is string => typeof value === "string";
const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";
const isStrings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(isString);

/** reads the macro calls of a module; none when it doesn't import a macro */
function readCalls(code: string, file: string): MacroCall[] {
  const fail = (node: Node, message: string) => errorAt(file, code, node.start, message);
  const program = parseAst(
    code,
    { lang: /\.m?ts$/.test(file) ? "ts" : "js" },
    file,
  ) as unknown as Node;

  const macros = new Map<string, MacroName>();
  for (const statement of program.body as Node[]) {
    if (
      (statement.type === "ExportNamedDeclaration" || statement.type === "ExportAllDeclaration") &&
      statement.source?.value === MACRO_MODULE
    ) {
      throw fail(statement, `re-exporting from ${MACRO_MODULE} is not supported.`);
    }
    if (statement.type !== "ImportDeclaration" || statement.source.value !== MACRO_MODULE) continue;
    if (statement.importKind === "type") continue;
    for (const spec of statement.specifiers as Node[]) {
      if (spec.type !== "ImportSpecifier") {
        throw fail(spec, `only named imports are supported for ${MACRO_MODULE}.`);
      }
      const name = spec.imported.name ?? spec.imported.value;
      if (spec.importKind !== "type" && (name === "defineDocs" || name === "defineCollections")) {
        macros.set(spec.local.name, name);
      }
    }
  }
  if (macros.size === 0) return [];

  /** the value of an option, the last one written; a spread could hide it */
  function option(object: Node | undefined, name: string): Node | undefined {
    for (const property of [...((object?.properties as Node[]) ?? [])].reverse()) {
      if (property.type === "SpreadElement") {
        throw fail(
          property,
          `the options of a macro cannot be spread, since its \`${name}\` option affects how content files are bundled.`,
        );
      }
      if (propertyKey(property) === name) return property.value;
    }
  }

  function literal<T>(
    object: Node | undefined,
    name: string,
    check: (value: unknown) => value is T,
    expected: string,
  ): T | undefined {
    const node = option(object, name);
    if (!node) return;
    const result = staticValue(node);
    if (!result || !check(result.value)) {
      throw fail(
        node,
        `the \`${name}\` option of a macro must be ${expected}, since it affects how content files are bundled. Move dynamic logic into other options like \`schema\`.`,
      );
    }
    return result.value;
  }

  /** `docs` and `meta` of `defineDocs`, which hold literals too */
  function group(object: Node | undefined, name: string): Node | undefined {
    const node = option(object, name);
    if (node && node.type !== "ObjectExpression") {
      throw fail(
        node,
        `the \`${name}\` option of a macro must be an object literal, since its \`files\` option affects how content files are bundled.`,
      );
    }
    return node;
  }

  function collectionOf(macro: MacroName, call: Node, options: Node | undefined): MacroCollection {
    const dir = literal(options, "dir", isString, "a string literal") ?? DEFAULT_DIR;
    if (macro === "defineDocs") {
      const docs = group(options, "docs");
      return {
        dir,
        pages: literal(docs, "files", isStrings, "an array of string literals") ?? DEFAULT_PAGES,
        meta:
          literal(group(options, "meta"), "files", isStrings, "an array of string literals") ??
          DEFAULT_META,
        lastModified: literal(docs, "lastModified", isBoolean, "a boolean literal") ?? false,
      };
    }

    const type = literal(
      options,
      "type",
      (value) => value === "doc" || value === "meta",
      '"doc" or "meta"',
    );
    if (type === undefined) throw fail(call, "defineCollections requires a `type` option.");
    const files = literal(options, "files", isStrings, "an array of string literals");
    if (type === "meta") return { dir, meta: files ?? DEFAULT_META, lastModified: false };
    return {
      dir,
      pages: files ?? DEFAULT_PAGES,
      lastModified: literal(options, "lastModified", isBoolean, "a boolean literal") ?? false,
    };
  }

  // the compiled call is awaited, which only a top-level statement can do
  const calls: MacroCall[] = [];
  const callees = new Set<Node>();
  for (const statement of program.body as Node[]) {
    const target =
      statement.type === "ExportNamedDeclaration" && statement.declaration
        ? statement.declaration
        : statement;
    if (target.type !== "VariableDeclaration") continue;

    for (const declarator of target.declarations as Node[]) {
      const init: Node | null = declarator.init;
      if (init?.type !== "CallExpression" || init.callee.type !== "Identifier") continue;
      const macro = macros.get(init.callee.name);
      if (!macro) continue;

      if (declarator.id.type !== "Identifier") {
        throw fail(
          declarator.id,
          `a macro collection must be assigned to a plain variable (e.g. \`const docs = ${macro}({ ... })\`), destructuring is not supported.`,
        );
      }
      if (target.kind !== "const") {
        throw fail(
          target,
          `a macro collection must be declared with \`const\`, since \`${target.kind}\` bindings can be reassigned.`,
        );
      }
      const args = init.arguments as Node[];
      if (args.length > 1 || (args[0] && args[0].type !== "ObjectExpression")) {
        throw fail(init, "macro calls only accept an inline options object.");
      }

      callees.add(init.callee);
      calls.push({ node: init, options: args[0], collection: collectionOf(macro, init, args[0]) });
    }
  }

  // any other use of a macro, like a nested call or an alias
  walkReferences(program, (node) => {
    if (macros.has(node.name) && !callees.has(node)) {
      throw fail(
        node,
        `macros from ${MACRO_MODULE} can only be called as the initializer of a top-level \`const\` declaration, like \`const docs = defineDocs({ ... })\`.`,
      );
    }
  });
  return calls;
}

/** the collections that the macro calls of a module declare, read without running it */
export function readMacros(code: string, file: string): MacroCollection[] {
  return readCalls(code, file).map((call) => call.collection);
}

/** a pattern of `files` from the folder of `import.meta.glob`, which starts with `./` */
function globPattern(pattern: string): string {
  const exclude = pattern.startsWith("!");
  const own = exclude ? pattern.slice(1) : pattern;
  return `${exclude ? "!" : ""}${/^\.\.?\//.test(own) ? own : `./${own}`}`;
}

/** the files of a collection, as the module imports them: the argument the compiled call adds */
async function filesOf(collection: MacroCollection, root: string): Promise<string> {
  const dir = path.resolve(root, collection.dir);
  const fromRoot = normalizePath(path.relative(root, dir));
  // `base` from the project root, which a virtual module can use too: the keys are `./` and the path from `dir`
  const globOf = (patterns: string[], options: object) =>
    `import.meta.glob(${JSON.stringify([...patterns, ...HIDDEN].map(globPattern))}, ${JSON.stringify({ base: `/${fromRoot}`, ...options })})`;

  const fields = [`dir: ${JSON.stringify(fromRoot)}`];
  if (collection.pages) {
    const pages = [
      // the frontmatter only, which the server validates when it starts
      `frontmatter: ${globOf(collection.pages, { query: "?frontmatter", import: "default", eager: true })}`,
      `load: ${globOf(collection.pages, {})}`,
      `assets: ${globOf(collection.pages, { query: "?assets=client", import: "default" })}`,
    ];
    if (collection.lastModified) {
      // one `git log` for the folder, when the module is compiled: a deployed server has no repository
      const dates = Object.fromEntries(
        [...(await lastCommitDates(dir))].flatMap(([file, date]) =>
          /\.mdx?$/.test(file) ? [[`./${normalizePath(path.relative(dir, file))}`, date]] : [],
        ),
      );
      pages.push(`lastModified: ${JSON.stringify(dates)}`);
    }
    fields.push(`pages: { ${pages.join(", ")} }`);
  }
  if (collection.meta) {
    fields.push(`meta: ${globOf(collection.meta, { import: "default", eager: true })}`);
  }
  return `{ ${fields.join(", ")} }`;
}

/**
 * Compiles the macro calls of a module: `defineDocs(options)` becomes `await defineDocs(options, files)`, where
 * `files` are `import.meta.glob` imports of its folder. The options stay, with the schemas the server validates with.
 * None when the module calls no macro.
 */
export async function transformMacros(
  code: string,
  file: string,
  root: string,
): Promise<{ code: string; map: ReturnType<MagicString["generateMap"]> } | undefined> {
  const calls = readCalls(code, file);
  if (calls.length === 0) return;

  const s = new MagicString(code);
  for (const { node, options, collection } of calls) {
    const files = await filesOf(collection, root);
    s.appendLeft(node.start, "await ");
    // after the options, so a trailing comma stays valid
    if (options) s.appendLeft(options.end, `, ${files}`);
    else s.appendLeft(node.end - 1, `undefined, ${files}`);
  }
  return {
    code: s.toString(),
    map: s.generateMap({ hires: "boundary", source: file, includeContent: true }),
  };
}

/** the pages of a collection on disk, matched like `import.meta.glob` matches them: the entries of the browser build */
export async function listPages(collection: MacroCollection, root: string): Promise<string[]> {
  if (!collection.pages) return [];
  const cwd = path.resolve(root, collection.dir);
  const patterns = [...collection.pages, ...HIDDEN];
  const include = patterns.filter((pattern) => !pattern.startsWith("!"));
  const exclude = patterns.flatMap((pattern) =>
    pattern.startsWith("!") ? [pattern.slice(1)] : [],
  );
  const files: string[] = [];
  for await (const file of glob(include, { cwd, exclude })) {
    files.push(normalizePath(path.join(cwd, file)));
  }
  return files.sort();
}
