import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/source.ts", "src/renderer.ts"],
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
});
