import { createPress } from "fumapress";
import { llmsPlugin } from "fumapress/plugins/llms.txt";
import { takumiPlugin } from "fumapress/plugins/takumi";
import { createOpenAPI } from "fumadocs-openapi/server";
import { lucideIconsPlugin } from "fumadocs-core/source/plugins/lucide-icons";
import { flexsearchPlugin } from "fumapress/plugins/flexsearch";
import openapiPlugin from "fumadocs-openapi/press";
import path from "node:path";
import { defineI18n } from "fumadocs-core/i18n";
import { zhTW } from "@fumapress/language/zh-tw";
import { defineDocs } from "fumadocs-mdx/macro";

const openapi = createOpenAPI({
  input: [path.resolve("./scalar.yaml")],
  proxyUrl: "/_proxy",
});

const i18n = defineI18n({
  languages: ["cn", "en"],
  defaultLanguage: "en",
});

const docs = defineDocs({
  dir: "content/docs",
  docs: {
    async: true,
    lastModified: true,
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
});

export default createPress(
  {
    docs: docs.toFumadocsSource(),
    openapi: await openapi.staticSource(),
  },
  {
    i18n,
    loaderOptions: {
      plugins: [lucideIconsPlugin()],
    },
  },
)
  .plugins(
    flexsearchPlugin(),
    llmsPlugin(),
    takumiPlugin(),
    openapiPlugin({ server: openapi, createProxy: true }),
  )
  .config({
    ui: { translations: i18n.translations().preset("cn", zhTW()) },
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
