import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["./src/index.tsx"],
  target: "es2023",
  format: "esm",
  dts: true,
  exports: true,
  deps: {
    onlyBundle: ["@fumadocs/sanity"],
  },
});
