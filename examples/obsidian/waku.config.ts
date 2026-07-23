import { obsidianVitePlugin } from "@fumapress/obsidian/vite";
import tailwindcss from "@tailwindcss/vite";
import press from "fumapress/vite";
import { defineConfig } from "waku/config";

export default defineConfig({
  vite: {
    resolve: {
      dedupe: ["fumadocs-ui"],
    },
    plugins: [press(), obsidianVitePlugin(), tailwindcss()],
  },
});
