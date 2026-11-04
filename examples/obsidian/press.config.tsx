import { obsidian, obsidianPlugin } from "@fumapress/obsidian";
import { lucideIconsPlugin } from "fumadocs-core/source/plugins/lucide-icons";
import { createPress } from "fumapress";

const vault = obsidian({
  dir: "public/vault",
  url: (file) => `/vault/${file}`,
});

export default createPress(vault.dynamicSource(), {
  loaderOptions: {
    plugins: [lucideIconsPlugin()],
  },
})
  .plugins(obsidianPlugin(vault))
  .config({
    site: {
      baseUrl: "https://example.com",
      name: "Obsidian Example",
    },
  });
