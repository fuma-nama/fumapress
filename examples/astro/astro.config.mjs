// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import press from "@fumapress/astro";

export default defineConfig({
  site: "https://example.com",
  integrations: [
    press({
      components: "./src/components/mdx.tsx",
      includeProcessedMarkdown: { output: "function" },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
