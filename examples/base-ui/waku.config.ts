import { defineConfig } from "waku/config";
import tailwindcss from "@tailwindcss/vite";
import press from "fumapress/vite";
import mdx from "fumadocs-mdx/vite";

export default defineConfig({
  vite: {
    resolve: {
      dedupe: ["fumadocs-ui"],
    },
    optimizeDeps: {
      include: ["use-sync-external-store/shim/with-selector", "use-sync-external-store/shim"],
    },
    plugins: [press(), mdx(), tailwindcss()],
  },
});
