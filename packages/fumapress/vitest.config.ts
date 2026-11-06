import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "fumapress",
    environment: "node",
    include: ["test/**/*.test.{ts,tsx}"],
  },
  resolve: {
    // the styles of the root layout, from Vite in the app
    alias: [
      {
        find: "virtual:fumapress/renderers",
        replacement: new URL("./test/stubs/renderers.ts", import.meta.url).pathname,
      },
      {
        find: /^virtual:fumapress\/css\?.*$/,
        replacement: new URL("./test/stubs/empty.ts", import.meta.url).pathname,
      },
    ],
    tsconfigPaths: true,
  },
});
