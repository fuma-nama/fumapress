import { defineConfig } from "waku/config";
import tailwindcss from "@tailwindcss/vite";
import press from "fumapress/vite";
import mdx from "fumadocs-mdx/vite";
import { createGenerator, remarkAutoTypeTable } from "fumadocs-typescript";
import { defineConfig as defineMdxConfig } from "fumadocs-mdx/config";

const generator = createGenerator();

const mdxConfig = defineMdxConfig({
  mdxOptions: {
    remarkPlugins: [[remarkAutoTypeTable, { generator }]],
    rehypeCodeOptions: {
      themes: {
        light: "vitesse-light",
        dark: "catppuccin-mocha",
      },
    },
  },
});

export default defineConfig({
  vite: {
    resolve: {
      dedupe: ["fumadocs-ui"],
    },
    plugins: [
      press(),
      mdx({
        default: mdxConfig,
      }),
      tailwindcss(),
    ],
  },
});
