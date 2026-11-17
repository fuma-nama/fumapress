import { fileURLToPath } from "node:url";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vitest/config";

const src = (file: string) => fileURLToPath(new URL(`./src/${file}`, import.meta.url));

/**
 * Tests run without a build: the built entries the UI imports by name resolve to their sources. `.vue` files are
 * compiled for the environment of a test, for the server in `node` and for the browser in `jsdom`.
 */
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@fumapress/vue/client": src("client.ts"),
      "@fumapress/vue/i18n": src("i18n.ts"),
      "@fumapress/vue/page-tree": src("page-tree.ts"),
      "@fumapress/vue/highlight": src("highlight.ts"),
      "@fumapress/vue/markdown": src("markdown.ts"),
      "@fumapress/vue/reka": src("reka"),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "vue",
          environment: "node",
          include: ["test/**/*.test.ts"],
          exclude: ["test/ui-layouts.test.ts"],
        },
      },
      {
        // the layouts are rendered on the server by its global setup, then hydrated in jsdom
        extends: true,
        test: {
          name: "vue-hydration",
          environment: "jsdom",
          include: ["test/ui-layouts.test.ts"],
          globalSetup: ["test/ui/render-layouts.ts"],
        },
      },
    ],
  },
});
