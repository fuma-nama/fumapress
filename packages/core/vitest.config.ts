import { defineConfig } from "vitest/config";

export default defineConfig({
  define: {
    __FUMAPRESS_IMAGE_CONFIG__: undefined,
  },
  test: {
    name: "core",
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
  resolve: {
    tsconfigPaths: true,
  },
});
