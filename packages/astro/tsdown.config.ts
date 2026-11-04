import { defineConfig } from "tsdown";
import { compilePresetCss, coreUiSource } from "../shared/compile-preset-css.ts";

export default defineConfig({
  // with the modules of `.astro` files and the generated code, their exports are kept
  entry: [
    "src/{index,config,runtime,search}.ts",
    "src/plugins/*.ts",
    "src/routes/{file,middleware,shared}.ts",
    "src/ui/{page,content,default}.tsx",
    "src/island/{island.tsx,references.ts}",
  ],
  target: "es2023",
  format: "esm",
  fixedExtension: false,
  dts: {
    sourcemap: false,
  },
  unbundle: true,
  // `.astro` files are compiled by Astro
  copy: [
    { from: "src/routes/*.astro", to: "dist/routes" },
    { from: "src/ui/*.astro", to: "dist/ui" },
    { from: "src/island/*.astro", to: "dist/island" },
    { from: "src/components/*.astro", to: "dist/components" },
  ],
  exports: {
    enabled: true,
    exclude: [/^(\.\/)?(routes|ui|island)\//],
    customExports: {
      "./components/*": "./dist/components/*",
      "./css/preset.css": "./css/preset.css",
      "./css/default.css": "./css/default.css",
    },
  },
  deps: {
    onlyBundle: [],
    neverBundle: [/^astro:/, /^virtual:/, /\.astro$/],
  },
  onSuccess: () => compilePresetCss(coreUiSource),
});
