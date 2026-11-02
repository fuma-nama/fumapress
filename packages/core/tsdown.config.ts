import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/plugins/*.{ts,tsx}"],
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
