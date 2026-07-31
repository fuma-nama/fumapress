import { defineConfig } from "waku/config";
import tailwindcss from "@tailwindcss/vite";
import press from "fumapress/vite";
import { fumadocsMdx } from "fumadocs-mdx/vite";
import { createGenerator, remarkAutoTypeTable } from "fumadocs-typescript";

const generator = createGenerator();

export default defineConfig({
  vite: {
    resolve: {
      dedupe: ["fumadocs-ui"],
    },
    plugins: [
      press(),
      fumadocsMdx({
        globalOptions: {
          mdxOptions: {
            remarkPlugins: [[remarkAutoTypeTable, { generator }]],
            rehypeCodeOptions: {
              themes: {
                light: "vitesse-light",
                dark: "catppuccin-mocha",
              },
            },
          },
        },
      }),
      tailwindcss(),
    ],
  },
});
