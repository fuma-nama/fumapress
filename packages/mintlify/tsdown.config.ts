import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["./src/index.tsx", "./src/{openapi,asyncapi}.ts"],
  target: "es2023",
  format: "esm",
  dts: true,
  exports: true,
});
