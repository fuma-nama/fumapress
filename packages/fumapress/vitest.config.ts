import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "fumapress",
    environment: "node",
    include: ["test/**/*.test.{ts,tsx}"],
  },
  resolve: {
    tsconfigPaths: true,
  },
});
