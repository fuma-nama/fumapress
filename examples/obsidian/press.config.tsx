import { obsidian } from "fumadocs-obsidian";
import { watchWithVite } from "fumadocs-obsidian/dev/vite";
import obsidianPlugin from "fumadocs-obsidian/press";
import { lucideIconsPlugin } from "fumadocs-core/source/plugins/lucide-icons";
import defaultMdxComponents from "fumadocs-ui/mdx";
import { createPress } from "fumapress";

const vault = obsidian({
  dir: "public/vault",
  url: (file) => `/vault/${file}`,
});

if (import.meta.env.DEV) watchWithVite(vault);

export default createPress(vault.dynamicSource(), {
  loaderOptions: {
    plugins: [lucideIconsPlugin()],
  },
})
  .plugins(obsidianPlugin({ vault, components: defaultMdxComponents }))
  .config({
    site: {
      baseUrl: "https://example.com",
      name: "Obsidian Example",
    },
  });
