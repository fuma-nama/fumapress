import { createPress, recommendedPreset } from "fumapress";
import { lucideIconsPlugin } from "fumadocs-core/source/plugins/lucide-icons";
import { metaSchema, pageSchema } from "fumapress/schema";
import { blogPlugin } from "@fumapress/blog";
import { blogMetaSchema, blogPageSchema } from "@fumapress/blog/schema";
import { changelogPlugin } from "@fumapress/tegami";
import { changelogMetaSchema, changelogPageSchema } from "@fumapress/tegami/schema";
import { linkValidationPlugin } from "fumapress/plugins/link-validation";
import { vercelImage } from "fumapress/plugins/image/vercel";
import { mcpPlugin } from "@fumapress/ai";
import { defineDocs } from "fumadocs-mdx/macro";
import { layoutProps, renderPage } from "./src/ui/layout";
import { frameworkOf } from "./src/ui/framework";
import { DocsSearchDialog } from "./src/ui/search";
import { playgroundPlugin } from "./src/landing/playground/plugin";
import { paintingPlugin } from "./src/landing/painting";
import newsreaderLatin from "@fontsource-variable/newsreader/files/newsreader-latin-opsz-normal.woff2?url";

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

/** pages of the published docs, they were for Waku */
const movedPages = new Map([
  ["/docs/adapters", "/docs/content-sources"],
  ["/docs/adapters/mdx", "/docs/content-sources/fumadocs-mdx"],
  ["/docs/adapters/notion", "/docs/content-sources/notion"],
  ["/docs/adapters/obsidian", "/docs/content-sources/obsidian"],
  ["/docs/adapters/sanity", "/docs/content-sources/sanity"],
  ["/docs/assets", "/docs/content#images-and-files"],
  ["/docs/basics", "/docs/content"],
  ["/docs/collections", "/docs/content-sources"],
  ["/docs/config", "/docs/configuration"],
  ["/docs/layouts/docs", "/docs/layouts"],
  ["/docs/layouts/glass", "/docs/layouts"],
  ["/docs/layouts/home", "/docs/layouts"],
  ["/docs/layouts/notebook", "/docs/layouts"],
  ["/docs/layouts/spacious", "/docs/layouts"],
  ["/docs/markdown", "/docs/plugins/ai#llmstxt"],
  ["/docs/migrate", "/docs/migrate/v2"],
  ["/docs/plugins/asyncapi", "/docs/plugins/api-docs#asyncapi"],
  ["/docs/plugins/flexsearch", "/docs/search"],
  ["/docs/plugins/graphql", "/docs/plugins/api-docs#graphql"],
  ["/docs/plugins/image", "/docs/content#image-optimization"],
  ["/docs/plugins/llms.txt", "/docs/plugins/ai#llmstxt"],
  ["/docs/plugins/mcp", "/docs/plugins/ai#mcp"],
  ["/docs/plugins/mintlify", "/docs/migrate/mintlify"],
  ["/docs/plugins/openapi", "/docs/plugins/api-docs#openapi"],
  ["/docs/plugins/orama-search", "/docs/search"],
  ["/docs/plugins/robots", "/docs/plugins/seo#robotstxt"],
  ["/docs/plugins/rss", "/docs/plugins/seo#rss"],
  ["/docs/plugins/sitemap", "/docs/plugins/seo#sitemap"],
  ["/docs/plugins/takumi", "/docs/plugins/seo#open-graph-images"],
  ["/docs/plugins/tegami", "/docs/plugins/changelog"],
  ["/docs/routing", "/docs/custom-pages"],
]);

export const app = createPress(
  {
    docs: docs.toFumadocsSource({ baseDir: "docs" }),
    blog: blog.toFumadocsSource({ baseDir: "blog" }),
    changelog: changelog.toFumadocsSource({ baseDir: "changelog" }),
  },
  { loaderPlugins: [lucideIconsPlugin()] },
).plugins(
  {
    name: "docs:moved-pages",
    middleware(request, next) {
      const location = movedPages.get(new URL(request.url).pathname);
      if (!location) return next();
      return Promise.resolve(new Response(null, { status: 308, headers: { Location: location } }));
    },
  },
  linkValidationPlugin(),
  mcpPlugin(),
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
  playgroundPlugin(),
  paintingPlugin(),
);

export default app.config({
  preset: recommendedPreset({
    search: {
      // the dialog filters by framework on the server
      render: "dynamic",
      async buildIndex(page) {
        return {
          id: page.url,
          title: page.data.title ?? page.path,
          description: page.data.description,
          url: page.url,
          structuredData: (await this.getPageStructuredData(page)) ?? {
            headings: [],
            contents: [],
          },
          tag: frameworkOf(page.url) ?? "site",
        };
      },
    },
    llms: {
      routes: "all",
      // processed Markdown keeps links as authored, and shared partials can only use relative ones
      async getLLMText(page) {
        const [text, loader] = await Promise.all([this.getPageText(page), this.getLoader()]);
        if (text === undefined) return;
        const resolved = text.replace(
          /\]\(<?(\.\.?\/[^)>]+)>?\)/g,
          (_, href: string) => `](${loader.resolveHref(href, page)})`,
        );
        return `# ${page.data.title} (${this.absoluteUrl(page.url)})\n\n${resolved}`;
      },
    },
    // the optimizer of Vercel has no route elsewhere, other builds keep plain image URLs
    image: false,
  }),
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
    // the Latin file of Newsreader, fetched with the page instead of after the stylesheet, so the headings render in it
    // from the first paint and don't move when it arrives
    {
      tag: "link",
      attrs: {
        rel: "preload",
        href: newsreaderLatin,
        as: "font",
        type: "font/woff2",
        crossorigin: "",
      },
    },
    { tag: "link", attrs: { rel: "icon", href: "/favicon.ico", sizes: "32x32" } },
    { tag: "link", attrs: { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" } },
  ],
  ui: {
    layoutProps,
    renderPage,
    providerProps: { search: { SearchDialog: DocsSearchDialog } },
  },
});
