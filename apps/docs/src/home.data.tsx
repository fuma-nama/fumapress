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
    description: <>Built-in full-text search, on your server or in the browser.</>,
    keywords: ["search", "flexsearch"],
    docsHref: "/docs/search#search-engines",
    usage: `import { createPress, recommendedPreset } from "fumapress";

export default createPress({
  // ...
}).config({
  preset: recommendedPreset({ search: { render: "dynamic" } }),
});`,
  },
  {
    id: "orama-search",
    name: "Orama Search",
    description: "Full-text search powered by ZBSearch with the same search dialog UX.",
    keywords: ["search", "orama", "zbsearch"],
    docsHref: "/docs/search#search-engines",
    usage: `import { createPress, recommendedPreset } from "fumapress";
import { oramaSearchPlugin } from "fumapress/plugins/orama-search";

export default createPress({
  // ...
})
  .plugins(oramaSearchPlugin())
  .config({ preset: recommendedPreset({ search: false }) });`,
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
    docsHref: "/docs/plugins/ai#llmstxt",
    usage: `import { createPress, recommendedPreset } from "fumapress";

export default createPress({
  // ...
}).config({
  preset: recommendedPreset({ llms: { routes: "all" } }),
});`,
  },
  {
    id: "blog",
    name: "Blog",
    description: "Turn a content collection into blog posts, an index and tag pages.",
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
}).plugins(blogPlugin({ source: "blog" }));`,
  },
  {
    id: "takumi",
    name: "Takumi",
    description: "Generate Open Graph images for every docs page automatically.",
    keywords: ["og", "open graph", "social"],
    docsHref: "/docs/plugins/seo#open-graph-images",
    usage: `import { createPress, recommendedPreset } from "fumapress";

export default createPress({
  // ...
}).config({
  preset: recommendedPreset({ ogImage: { width: 1600, height: 840 } }),
});`,
  },
  {
    id: "image",
    name: "Image Optimization",
    description:
      "Responsive & optimized images, configured automatically for your deployment target.",
    keywords: ["image", "sharp", "vercel"],
    docsHref: "/docs/content#image-optimization",
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
    docsHref: "/docs/plugins/seo#sitemap",
    usage: `import { createPress } from "fumapress";

export default createPress({
  // ...
}).config({
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
}).plugins(linkValidationPlugin());`,
  },
  {
    id: "openapi",
    name: "OpenAPI",
    description: "Generate API reference pages from an OpenAPI spec.",
    keywords: ["api", "openapi", "swagger"],
    docsHref: "/docs/plugins/api-docs#openapi",
    usage: `import { createPress } from "fumapress";
import { createOpenAPI } from "fumadocs-openapi/server";
import openapiPlugin from "fumadocs-openapi/press";

const openapi = createOpenAPI({
  input: ["./openapi.json"],
});

export default createPress({
  // ...
  openapi: await openapi.staticSource(),
}).plugins(openapiPlugin({ server: openapi }));`,
  },
  {
    id: "asyncapi",
    name: "AsyncAPI",
    description: "Generate event-driven API reference pages from an AsyncAPI spec.",
    keywords: ["api", "asyncapi", "events", "messaging"],
    docsHref: "/docs/plugins/api-docs#asyncapi",
    usage: `import { createPress } from "fumapress";
import { createAsyncAPI } from "@fumadocs/asyncapi/server";
import asyncapiPlugin from "@fumadocs/asyncapi/press";

const asyncapi = createAsyncAPI({
  input: ["./asyncapi.yaml"],
});

export default createPress({
  // ...
  asyncapi: await asyncapi.staticSource(),
}).plugins(asyncapiPlugin({ server: asyncapi }));`,
  },
  {
    id: "ai",
    name: "AI",
    description: 'Add an "Ask AI" chat powered by the Vercel AI SDK.',
    keywords: ["chat", "ask ai", "gpt"],
    docsHref: "/docs/plugins/ai#ai-chat",
    usage: `import { createPress } from "fumapress";
import { openai } from "@ai-sdk/openai";
import { aiPlugin } from "@fumapress/ai";

export default createPress({
  // ...
}).plugins(
  aiPlugin({
    model: openai("gpt-5"),
  }),
);`,
  },
  {
    id: "mcp",
    name: "MCP Server",
    description: "Expose your documentation to MCP clients over Streamable HTTP.",
    keywords: ["mcp", "model context protocol", "tools", "agents"],
    docsHref: "/docs/plugins/ai#mcp",
    usage: `import { createPress } from "fumapress";
import { mcpPlugin } from "@fumapress/ai";

export default createPress({
  // ...
}).plugins(mcpPlugin());`,
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
}).plugins(
  feedbackPlugin({
    async onPageFeedbackAction(data) {
      await analytics.track("page-feedback", data);
      return {};
    },
  }),
);`,
  },
  {
    id: "tegami",
    name: "Tegami",
    description: "Publish package changelogs to a filterable timeline page.",
    keywords: ["changelog", "releases", "tegami", "versioning"],
    docsHref: "/docs/plugins/changelog",
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
}).plugins(changelogPlugin({ source: "changelog" }));`,
  },
] as const;

export type Plugin = (typeof plugins)[number];
