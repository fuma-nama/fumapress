import { defineConfig } from "waku/config";
import tailwindcss from "@tailwindcss/vite";
import press from "fumapress/vite";
import mdx from "fumadocs-mdx/vite";

export default defineConfig({
  vite: {
    resolve: {
      dedupe: ["fumadocs-ui"],
    },
    plugins: [press(), mdx(), tailwindcss()],
  },
});
