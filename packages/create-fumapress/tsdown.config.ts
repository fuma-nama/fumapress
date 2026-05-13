import { defineConfig } from "tsdown";

export default defineConfig({
  target: "es2023",
  format: "esm",
  entry: ["src/index.ts"],
  dts: true,
  exports: {
    bin: "src/index.ts",
  },
  deps: {
    onlyBundle: [],
  },
});
