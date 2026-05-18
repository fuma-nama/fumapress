import { defineConfig } from "fumapress";
import { llmsPlugin } from "fumapress/plugins/llms.txt";
import { takumiPlugin } from "fumapress/plugins/takumi";
import { loader } from "fumadocs-core/source";
import { docs } from "./.source/server";
import { createOpenAPI, openapiSource } from "fumadocs-openapi/server";
import { lucideIconsPlugin } from "fumadocs-core/source/plugins/lucide-icons";
import { fumadocsMdx } from "fumapress/adapters/mdx";
import { flexsearchPlugin } from "fumapress/plugins/flexsearch";
import { openapiPlugin, openapiLoaderPlugin } from "fumapress/plugins/openapi";
import path from "node:path";

const openapi = createOpenAPI({
  input: [path.resolve("./scalar.yaml")],
});

export default defineConfig({
  mode: "static",
  loader: loader(
    {
      docs: docs.toFumadocsSource(),
      openapi: await openapiSource(openapi),
    },
    {
      baseUrl: "/",
      plugins: [lucideIconsPlugin(), openapiLoaderPlugin()],
    },
  ),
  meta: {
    root() {
      return (
        <>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
          <link
            href="https://fonts.googleapis.com/css2?family=Geist:ital,wght@0,100..900;1,100..900&family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&display=swap"
            rel="stylesheet"
          />
        </>
      );
    },
  },
})
  .useAdapters(fumadocsMdx())
  .usePlugins(flexsearchPlugin(), llmsPlugin(), takumiPlugin(), openapiPlugin({ server: openapi }));
