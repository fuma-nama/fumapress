import path from "node:path";
import { defineConfig, type UserConfig } from "tsdown";

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
  alias: {
    react: path.resolve("src/shims/react.ts"),
    "react-dom/server.edge": path.resolve("src/shims/react-dom-server.ts"),
  },
};
const bundled = [/^fumadocs-core/, /^@fumadocs\/satteri/];

export default defineConfig([
  {
    ...shared,
    // the Vite plugin, in Node
    entry: ["src/vite.ts"],
    platform: "node",
    deps: { alwaysBundle: bundled, onlyBundle: false },
  },
  {
    ...shared,
    // the runtime, in the app: on the server and in the browser
    entry: ["src/{config,content,client,server,jsx-runtime,page-tree,highlight}.ts"],
    platform: "neutral",
    clean: false,
    // `hast` stays a type import, so a highlighter typed with it fits `Highlighter`
    deps: { alwaysBundle: bundled, onlyBundle: false, neverBundle: [/^virtual:/, "hast"] },
  },
]);
