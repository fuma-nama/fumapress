import { defineConfig } from "tsdown";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/runtime/{index,vite}.ts",
    "src/page-tree.ts",
    "src/ui/*.tsx",
    "src/plugins/*.{ts,tsx}",
    "!src/plugins/*.client.{ts,tsx}",
  ],
  target: "es2023",
  format: "esm",
  dts: {
    sourcemap: false,
  },
  unbundle: true,
  exports: true,
  deps: {
    onlyBundle: [],
  },
});
