import { defineConfig } from "fumapress";
import { llmsPlugin } from "fumapress/plugins/llms.txt";
import { takumiPlugin } from "fumapress/plugins/takumi";
import { docs } from "./.source/server";
import { createOpenAPI } from "fumadocs-openapi/server";
import { lucideIconsPlugin } from "fumadocs-core/source/plugins/lucide-icons";
import { fumadocsMdx } from "fumapress/adapters/mdx";
import { flexsearchPlugin } from "fumapress/plugins/flexsearch";
import { openapiPlugin } from "fumapress/plugins/openapi";
import path from "node:path";
import { defineI18n } from "fumadocs-core/i18n";
import { zhTW } from "@fumapress/language/zh-tw";

const openapi = createOpenAPI({
  input: [path.resolve("./scalar.yaml")],
  proxyUrl: "/_proxy",
});

const translations = defineI18n({
  languages: ["cn", "en"],
  defaultLanguage: "en",
})
  .translations()
  .preset("cn", zhTW());

export default defineConfig({
  content: {
    docs: docs.toFumadocsSource(),
    openapi: await openapi.staticSource(),
  },
  translations,
  loaderOptions: {
    plugins: [lucideIconsPlugin()],
  },
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
  .adapters(fumadocsMdx())
  .plugins(
    flexsearchPlugin(),
    llmsPlugin(),
    takumiPlugin(),
    openapiPlugin({ server: openapi, createProxy: true }),
  );
