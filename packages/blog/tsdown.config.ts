import { defineConfig } from "tsdown";
import path from "node:path";
import { compilePresetCss } from "../shared/compile-preset-css.ts";
import { packageTranslationsPlugin } from "../shared/compile-package-translations.ts";

export default defineConfig({
  target: "es2023",
  format: "esm",
  ignoreWatch: ["src/.translations/**"],
  plugins: [packageTranslationsPlugin()],
  entry: ["src/index.ts", "src/i18n.ts", "src/schema.ts"],
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
    compilePresetCss({ base: path.resolve("src"), pattern: "components/**/*.{ts,tsx}" }),
});
