import { defineConfig } from "vite";
import { localContentPlugin } from "fumadocs-obsidian/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import press from "fumapress/vite";

export default defineConfig({
  plugins: [press(), localContentPlugin(), tailwindcss()],
});
