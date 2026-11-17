import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/bin.ts"],
  target: "es2023",
  format: "esm",
  platform: "node",
  fixedExtension: false,
});
