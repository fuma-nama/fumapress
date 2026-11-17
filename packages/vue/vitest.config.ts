import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "vue",
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
