import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "ai",
    environment: "node",
    include: ["test/**/*.test.{ts,tsx}"],
  },
  resolve: {
    tsconfigPaths: true,
  },
});
