import { createPress } from "fumapress";
import { createOpenAPI } from "fumadocs-openapi/server";
import { lucideIconsPlugin } from "fumadocs-core/source/plugins/lucide-icons";
import openapiPlugin from "fumadocs-openapi/press";
import { defineDocs } from "fumadocs-mdx/macro";
import { pageSchema, metaSchema } from "fumadocs-core/source/schema";

const openapi = createOpenAPI({
  input: ["https://registry.scalar.com/@scalar/apis/galaxy?format=json"],
  proxyUrl: "/_proxy",
});

const docs = defineDocs({
  dir: "content/docs",
  docs: {
    async: true,
    schema: pageSchema,
    lastModified: true,
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
  meta: {
    schema: metaSchema,
  },
});

export default createPress(
  {
    docs: docs.toFumadocsSource(),
    openapi: await openapi.staticSource(),
  },
  { loaderPlugins: [lucideIconsPlugin()] },
)
  .plugins(openapiPlugin({ server: openapi, createProxy: true }))
  .config({
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
    ],
  });
