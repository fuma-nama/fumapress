import { defineConfig } from "fumapress";
import { docs } from "./.source/server";
import { createOpenAPI } from "fumadocs-openapi/server";
import { lucideIconsPlugin } from "fumadocs-core/source/plugins/lucide-icons";
import { fumadocsMdx } from "fumapress/adapters/mdx";
import { openapiPlugin } from "fumapress/plugins/openapi";

const openapi = createOpenAPI({
  input: ["https://registry.scalar.com/@scalar/apis/galaxy?format=json"],
  proxyUrl: "/_proxy",
});

export default defineConfig({
  content: {
    docs: docs.toFumadocsSource(),
    openapi: await openapi.staticSource(),
  },
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
  .plugins(openapiPlugin({ server: openapi, createProxy: true }));
