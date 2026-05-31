import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "core",
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
  resolve: {
    tsconfigPaths: true,
  },
});
