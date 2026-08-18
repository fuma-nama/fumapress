import { defineConfig } from "vite";
import { obsidianVitePlugin } from "@fumapress/obsidian/vite";
import tailwindcss from "@tailwindcss/vite";
import press from "fumapress/vite";

export default defineConfig({
  plugins: [press(), obsidianVitePlugin(), tailwindcss()],
});
