import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { defineConfig, type UserConfig } from "tsdown";

/**
 * Writes `dist/THIRD-PARTY-LICENSES.md`: the license of every package bundled into `dist`, which their terms ask
 * to ship with the code.
 */
const packages = new Map<string, string>();
type Bundle = Record<string, { modules?: Record<string, { renderedLength: number }> }>;
const licenses = {
  name: "licenses",
  writeBundle(_: unknown, bundle: Bundle) {
    // the modules with code left in a file, after the unused ones are dropped
    const ids = Object.values(bundle).flatMap((file) =>
      Object.entries(file.modules ?? {}).flatMap(([id, mod]) => (mod.renderedLength > 0 ? id : [])),
    );
    for (const id of ids) {
      const [, dir] = /^(.*[\\/]node_modules[\\/](?:@[^\\/]+[\\/])?[^\\/]+)[\\/]/.exec(id) ?? [];
      if (!dir || !existsSync(path.join(dir, "package.json"))) continue;
      const { name, version, license } = JSON.parse(
        readFileSync(path.join(dir, "package.json"), "utf8"),
      );
      if (packages.has(name)) continue;
      const file = readdirSync(dir).find((file) => /^licen[cs]e(\.md|\.txt)?$/i.test(file));
      const text = file ? readFileSync(path.join(dir, file), "utf8").trim() : `License: ${license}`;
      packages.set(name, `## ${name} ${version}\n\n\`\`\`\n${text}\n\`\`\`\n`);
    }

    const names = [...packages.keys()].sort();
    mkdirSync("dist", { recursive: true });
    writeFileSync(
      "dist/THIRD-PARTY-LICENSES.md",
      `# Third-party licenses\n\nThis package includes code of these packages.\n\n${names.map((name) => packages.get(name)).join("\n")}`,
    );
  },
};

/**
 * The parts of Fumadocs this package uses are bundled, so a Vue project installs neither Fumadocs nor React: the
 * content loader, the Markdown plugins and the adapter of Highlights. `react` resolves to a shim for the one import
 * the loader has.
 */
const shared: UserConfig = {
  target: "es2023",
  format: "esm",
  dts: true,
  fixedExtension: false,
  plugins: [licenses],
  alias: {
    react: path.resolve("src/shims/react.ts"),
    "react-dom/server.edge": path.resolve("src/shims/react-dom-server.ts"),
  },
};
const bundled = [/^fumadocs-core/, /^@fumadocs\/(satteri|tailwind)/];

export default defineConfig([
  {
    ...shared,
    // the Vite plugin, in Node
    entry: ["src/vite.ts", "src/typography.ts"],
    platform: "node",
    deps: { alwaysBundle: bundled, onlyBundle: false },
  },
  {
    ...shared,
    // the runtime, in the app: on the server and in the browser
    entry: [
      "src/{config,content,schema,i18n,client,server,jsx-runtime,page-tree,highlight,markdown}.ts",
    ],
    platform: "neutral",
    clean: false,
    // `hast` stays a type import, so a highlighter typed with it fits `Highlighter`
    deps: { alwaysBundle: bundled, onlyBundle: false, neverBundle: [/^virtual:/, "hast"] },
  },
  {
    ...shared,
    // the families of Reka UI that the UI uses, so a site doesn't install it. A module of Reka UI stays a file, as
    // in its own build: a page loads the components it renders, not their families.
    entry: ["src/reka/*.ts"],
    outDir: "dist/reka",
    platform: "neutral",
    clean: false,
    unbundle: true,
    deps: { onlyBundle: false },
    // packages without an `exports` map
    inputOptions: { resolve: { mainFields: ["module", "main"] } },
    // a file of a package is at `lib/<package>/<path>`: npm doesn't publish a `node_modules` folder
    outputOptions: {
      entryFileNames: (chunk) => `${chunk.name.replace(/^.*node_modules\//, "lib/")}.js`,
    },
  },
]);
