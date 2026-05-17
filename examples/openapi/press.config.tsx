import { defineConfig } from "fumapress";
import { llmsPlugin } from "fumapress/plugins/llms.txt";
import { takumiPlugin } from "fumapress/plugins/takumi";
import { loader } from "fumadocs-core/source";
import { docs } from "./.source/server";
import { openapiSource } from "fumadocs-openapi/server";
import { lucideIconsPlugin } from "fumadocs-core/source/plugins/lucide-icons";
import { fumadocsMdx } from "fumapress/adapters/mdx";
import { flexsearchPlugin } from "fumapress/plugins/flexsearch";
import { openapi } from "./src/openapi";
import { ClientAPIPage } from "./src/api-page";
import { openapiPlugin } from "fumapress/plugins/openapi";

export default defineConfig({
  mode: "static",
  loader: loader(
    {
      docs: docs.toFumadocsSource(),
      openapi: await openapiSource(openapi),
    },
    {
      baseUrl: "/",
      plugins: [lucideIconsPlugin(), openapiPlugin.loaderPlugin()],
    },
  ),
})
  .useAdapters(fumadocsMdx())
  .usePlugins(flexsearchPlugin(), llmsPlugin(), takumiPlugin(), openapiPlugin({ ClientAPIPage }));
