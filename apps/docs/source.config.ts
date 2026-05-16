import { defineConfig, defineDocs } from "fumadocs-mdx/config";
import {
  blogMetaSchema,
  blogPageSchema,
  metaSchema,
  pageSchema,
} from "fumapress/adapters/mdx/schema";
import lastModified from "fumadocs-mdx/plugins/last-modified";

// You can customize Zod schemas for frontmatter and `meta.json` here
// see https://fumadocs.dev/docs/mdx/collections
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

export default defineConfig({
  plugins: [lastModified()],
});
