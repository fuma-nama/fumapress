import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.tsx", "src/ui.ts"],
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
