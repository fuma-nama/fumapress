import { defineConfig, defineDocs } from "fumadocs-mdx/config";
import { remarkAutoTypeTable, createGenerator } from "fumadocs-typescript";
import {
  blogMetaSchema,
  blogPageSchema,
  metaSchema,
  pageSchema,
} from "fumapress/adapters/mdx/schema";
import { changelogMetaSchema, changelogPageSchema } from "@fumapress/tegami/schema";
import lastModified from "fumadocs-mdx/plugins/last-modified";

const generator = createGenerator();

export const docs = defineDocs({
  dir: "content/docs",
  docs: {
    async: true,
    schema: pageSchema,
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
  meta: {
    schema: metaSchema,
  },
});

export const blog = defineDocs({
  dir: "content/blog",
  docs: {
    async: true,
    schema: blogPageSchema,
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
  meta: {
    schema: blogMetaSchema,
  },
});

export const changelog = defineDocs({
  dir: "content/changelog",
  docs: {
    async: true,
    schema: changelogPageSchema,
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
  meta: {
    schema: changelogMetaSchema,
  },
});

export default defineConfig({
  plugins: [lastModified()],
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
