import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["./src/{index,openapi,i18n}.ts"],
  target: "es2023",
  format: "esm",
  dts: true,
  exports: true,
});
