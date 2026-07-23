import { obsidian, obsidianPlugin } from "@fumapress/obsidian";
import { lucideIconsPlugin } from "fumadocs-core/source/plugins/lucide-icons";
import { defineConfig } from "fumapress";

const vault = obsidian({
  dir: "public/vault",
  url: (file) => `/vault/${file}`,
});

export default defineConfig({
  content: vault.dynamicSource(),
  loaderOptions: {
    plugins: [lucideIconsPlugin()],
  },
  site: {
    baseUrl: "https://example.com",
    name: "Obsidian Example",
  },
}).plugins(obsidianPlugin(vault));
