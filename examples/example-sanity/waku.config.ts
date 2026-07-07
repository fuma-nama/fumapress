import { defineConfig } from "waku/config";
import tailwindcss from "@tailwindcss/vite";
import press from "fumapress/vite";

export default defineConfig({
  vite: {
    resolve: {
      tsconfigPaths: true,
      dedupe: ["fumadocs-ui"],
    },
    plugins: [press(), tailwindcss()],
  },
});
