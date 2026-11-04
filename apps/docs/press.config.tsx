import { createPress } from "fumapress";
import { lucideIconsPlugin } from "fumadocs-core/source/plugins/lucide-icons";
import { metaSchema, pageSchema } from "fumapress/adapters/mdx/schema";
import { blogPlugin } from "@fumapress/blog";
import { blogMetaSchema, blogPageSchema } from "@fumapress/blog/schema";
import { changelogPlugin } from "@fumapress/tegami";
import { changelogMetaSchema, changelogPageSchema } from "@fumapress/tegami/schema";
import { linkValidationPlugin } from "fumapress/plugins/link-validation";
import { vercelImage } from "fumapress/plugins/image/vercel";
import { mcpPlugin } from "@fumapress/ai";
import { defineDocs } from "fumadocs-mdx/macro";
import { llmsPlugin } from "fumapress/plugins/llms.txt";
import { baseOptions, renderPage } from "./src/ui/layout";

const docsOptions = {
  async: true,
  lastModified: true,
  postprocess: {
    includeProcessedMarkdown: true,
  },
} as const;

const docs = defineDocs({
  dir: "content/docs",
  docs: { ...docsOptions, schema: pageSchema },
  meta: { schema: metaSchema },
});

const blog = defineDocs({
  dir: "content/blog",
  docs: { ...docsOptions, schema: blogPageSchema },
  meta: { schema: blogMetaSchema },
});

const changelog = defineDocs({
  dir: "content/changelog",
  docs: { ...docsOptions, schema: changelogPageSchema },
  meta: { schema: changelogMetaSchema },
});

export const app = createPress(
  {
    docs: docs.toFumadocsSource({ baseDir: "docs" }),
    blog: blog.toFumadocsSource({ baseDir: "blog" }),
    changelog: changelog.toFumadocsSource({ baseDir: "changelog" }),
  },
  { loaderOptions: { plugins: [lucideIconsPlugin()] } },
).plugins(
  linkValidationPlugin(),
  mcpPlugin(),
  llmsPlugin({ routes: "all" }),
  // `github.com/<user>.png` redirects to the avatars host, both are validated
  vercelImage({ domains: ["github.com", "avatars.githubusercontent.com"] }),
  blogPlugin({
    source: "blog",
    authors: {
      fuma: {
        name: "Fuma Nama",
        title: "Maintainer",
        url: "https://fuma-nama.dev",
        image: "https://github.com/fuma-nama.png",
      },
    },
  }),
  changelogPlugin({ source: "changelog" }),
);

export default app.config({
  site: {
    name: "Fumapress",
    baseUrl: import.meta.env.DEV ? "http://localhost:3000" : "https://press.fumadocs.dev",
    git: {
      user: "fuma-nama",
      branch: "dev",
      repo: "fumapress",
    },
  },
  head: [
    { tag: "link", attrs: { rel: "preconnect", href: "https://fonts.googleapis.com" } },
    {
      tag: "link",
      attrs: { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" },
    },
    {
      tag: "link",
      attrs: {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Geist:ital,wght@0,100..900;1,100..900&family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&display=swap",
      },
    },
    { tag: "link", attrs: { rel: "icon", href: "/favicon.ico", type: "image/x-icon" } },
  ],
  ui: { baseOptions, renderPage },
});
