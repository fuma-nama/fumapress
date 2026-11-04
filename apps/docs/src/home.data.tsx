/** shared with the client components of the landing page, whose module exports are client references on the server */
export const commands = {
  npm: "npm create fumapress",
  pnpm: "pnpm create fumapress",
  yarn: "yarn create fumapress",
  bun: "bunx create-fumapress",
};

export const plugins = [
  {
    id: "flexsearch",
    name: "FlexSearch",
    description: (
      <>
        Built-in full-text search with a static index and <code>/api/search</code>.
      </>
    ),
    keywords: ["search", "flexsearch"],
    docsHref: "/docs/plugins/flexsearch",
    usage: `import { createPress } from "fumapress";
import { flexsearchPlugin } from "fumapress/plugins/flexsearch";

export default createPress({
  // ...
})
  .plugins(flexsearchPlugin())
  .config({});`,
  },
  {
    id: "orama-search",
    name: "Orama Search",
    description: "Full-text search powered by ZBSearch with the same search dialog UX.",
    keywords: ["search", "orama", "zbsearch"],
    docsHref: "/docs/plugins/orama-search",
    usage: `import { createPress } from "fumapress";
import { oramaSearchPlugin } from "fumapress/plugins/orama-search";

export default createPress({
  // ...
})
  .plugins(oramaSearchPlugin())
  .config({});`,
  },
  {
    id: "llms",
    name: "llms.txt",
    description: (
      <>
        Expose <code>/llms.txt</code>, <code>/llms-full.txt</code>, and per-page markdown for AI
        tools.
      </>
    ),
    keywords: ["llm", "ai", "markdown"],
    docsHref: "/docs/plugins/llms.txt",
    usage: `import { createPress } from "fumapress";
import { llmsPlugin } from "fumapress/plugins/llms.txt";

export default createPress({
  // ...
})
  .plugins(llmsPlugin())
  .config({});`,
  },
  {
    id: "blog",
    name: "Blog",
    description: "Turn a content collection into blog routes, panels, and RSS.",
    keywords: ["blog", "rss", "posts"],
    docsHref: "/docs/plugins/blog",
    usage: `import { createPress } from "fumapress";
import { blogPlugin } from "@fumapress/blog";
import { defineDocs } from "fumadocs-mdx/macro";

const docs = defineDocs({
  dir: "content/docs",
  docs: { async: true },
});
const blog = defineDocs({
  dir: "content/blog",
  docs: { async: true },
});

export default createPress({
  docs: docs.toFumadocsSource(),
  blog: blog.toFumadocsSource({ baseDir: "blog" }),
})
  .plugins(blogPlugin({ source: "blog" }))
  .config({});`,
  },
  {
    id: "takumi",
    name: "Takumi",
    description: "Generate Open Graph images for every docs page automatically.",
    keywords: ["og", "open graph", "social"],
    docsHref: "/docs/plugins/takumi",
    usage: `import { createPress } from "fumapress";
import { takumiPlugin } from "fumapress/plugins/takumi";

export default createPress({
  // ...
})
  .plugins(takumiPlugin())
  .config({});`,
  },
  {
    id: "image",
    name: "Image Optimization",
    description:
      "Responsive & optimized images, configured automatically for your deployment target.",
    keywords: ["image", "sharp", "vercel"],
    docsHref: "/docs/plugins/image",
    usage: `import { Image } from "fumapress/image";

export default function Hero() {
  return <Image src="/hero.png" width={1200} height={630} />;
}`,
  },
  {
    id: "sitemap",
    name: "Sitemap",
    description: (
      <>
        Generate <code>/sitemap.xml</code> from your content and static routes.
      </>
    ),
    keywords: ["seo", "sitemap", "xml"],
    docsHref: "/docs/plugins/sitemap",
    usage: `import { createPress } from "fumapress";
import { sitemapPlugin } from "fumapress/plugins/sitemap";

export default createPress({
  // ...
})
  .plugins(sitemapPlugin())
  .config({
    site: { baseUrl: "https://example.com" },
  });`,
  },
  {
    id: "link-validation",
    name: "Link Validation",
    description: (
      <>
        Fail the build when rendered <code>{`<Link />`}</code> targets return 404.
      </>
    ),
    keywords: ["links", "404", "build"],
    docsHref: "/docs/plugins/link-validation",
    usage: `import { createPress } from "fumapress";
import { linkValidationPlugin } from "fumapress/plugins/link-validation";

export default createPress({
  // ...
})
  .plugins(linkValidationPlugin())
  .config({});`,
  },
  {
    id: "openapi",
    name: "OpenAPI",
    description: "Generate API reference pages from an OpenAPI spec.",
    keywords: ["api", "openapi", "swagger"],
    docsHref: "/docs/plugins/openapi",
    usage: `import { createPress } from "fumapress";
import { createOpenAPI } from "fumadocs-openapi/server";
import { openapiPlugin } from "fumadocs-openapi/plugin";

const openapi = createOpenAPI({
  input: ["./openapi.json"],
});

export default createPress({
  // ...
  openapi: await openapi.staticSource(),
})
  .plugins(openapiPlugin({ server: openapi }))
  .config({});`,
  },
  {
    id: "asyncapi",
    name: "AsyncAPI",
    description: "Generate event-driven API reference pages from an AsyncAPI spec.",
    keywords: ["api", "asyncapi", "events", "messaging"],
    docsHref: "/docs/plugins/asyncapi",
    usage: `import { createPress } from "fumapress";
import { createAsyncAPI } from "@fumadocs/asyncapi/server";
import { asyncapiPlugin } from "@fumadocs/asyncapi/plugin";

const asyncapi = createAsyncAPI({
  input: ["./asyncapi.yaml"],
});

export default createPress({
  // ...
  asyncapi: await asyncapi.staticSource(),
})
  .plugins(asyncapiPlugin({ server: asyncapi }))
  .config({});`,
  },
  {
    id: "ai",
    name: "AI",
    description: 'Add an "Ask AI" chat powered by the Vercel AI SDK.',
    keywords: ["chat", "ask ai", "gpt"],
    docsHref: "/docs/plugins/ai",
    usage: `import { createPress } from "fumapress";
import { openai } from "@ai-sdk/openai";
import { aiPlugin } from "@fumapress/ai";

export default createPress({
  // ...
})
  .plugins(
    aiPlugin({
      model: openai("gpt-5"),
    }),
  )
  .config({});`,
  },
  {
    id: "mcp",
    name: "MCP Server",
    description: "Expose your documentation to MCP clients over Streamable HTTP.",
    keywords: ["mcp", "model context protocol", "tools", "agents"],
    docsHref: "/docs/plugins/mcp",
    usage: `import { createPress } from "fumapress";
import { mcpPlugin } from "@fumapress/ai";

export default createPress({
  // ...
})
  .plugins(mcpPlugin())
  .config({});`,
  },
  {
    id: "feedback",
    name: "Feedback",
    description: "Collect page and text feedback with server actions or integrations.",
    keywords: ["feedback", "survey"],
    docsHref: "/docs/plugins/feedback",
    usage: `import { createPress } from "fumapress";
import { feedbackPlugin } from "@fumapress/feedback";

export default createPress({
  // ...
})
  .plugins(
    feedbackPlugin({
      onPageFeedbackAction(data) {
        "use server";
        // ...
      },
    }),
  )
  .config({});`,
  },
  {
    id: "tegami",
    name: "Tegami",
    description: "Publish package changelogs to a filterable timeline page.",
    keywords: ["changelog", "releases", "tegami", "versioning"],
    docsHref: "/docs/plugins/tegami",
    usage: `import { createPress } from "fumapress";
import { changelogPlugin } from "@fumapress/tegami";
import { defineDocs } from "fumadocs-mdx/macro";

const docs = defineDocs({
  dir: "content/docs",
  docs: { async: true },
});
const changelog = defineDocs({
  dir: "content/changelog",
  docs: { async: true },
});

export default createPress({
  docs: docs.toFumadocsSource(),
  changelog: changelog.toFumadocsSource({ baseDir: "changelog" }),
})
  .plugins(changelogPlugin({ source: "changelog" }))
  .config({});`,
  },
] as const;

export type Plugin = (typeof plugins)[number];
