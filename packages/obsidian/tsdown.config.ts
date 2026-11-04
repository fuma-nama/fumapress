import { defineConfig } from "tsdown";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compilePresetCss } from "../shared/compile-preset-css.ts";

export default defineConfig({
  entry: ["src/index.ts", "src/vite.ts"],
  target: "es2023",
  format: "esm",
  dts: {
    sourcemap: false,
  },
  unbundle: true,
  exports: {
    customExports: {
      "./css/preset.css": "./css/preset.css",
    },
  },
  deps: {
    onlyBundle: [],
  },
  onSuccess: () =>
    compilePresetCss({
      base: path.dirname(fileURLToPath(import.meta.resolve("fumadocs-obsidian/ui"))),
      pattern: "**/*.js",
    }),
});
