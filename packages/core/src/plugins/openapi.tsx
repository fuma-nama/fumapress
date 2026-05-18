import type { ConfigContext } from "@/config";
import type { DocsLayoutContextData } from "@/layouts/docs";
import type { ServerPlugin } from "@/lib/types";
import { openapiPlugin as openapiLoaderPlugin } from "fumadocs-openapi/server";
import type { Adapter } from "@/lib/types";
import type { OpenAPIPageData, OpenAPIServer } from "fumadocs-openapi/server";
import type { ClientApiPageProps } from "fumadocs-openapi/ui/create-client";
import type { FC } from "react";
import { PayloadObject, PayloadProvider, WithPayload } from "@/components/openapi.payload";
import { unstable_notFound } from "waku/router/server";

export interface OpenAPIOptions {
  server: OpenAPIServer;
  /** must be a client component */
  ClientAPIPage?: FC<ClientApiPageProps>;
}

/**
 * this will register the OpenAPI adapter & required layout configs.
 */
export function openapiPlugin<C extends ConfigContext>(options: OpenAPIOptions): ServerPlugin<C> {
  function initRenderers(data: DocsLayoutContextData) {
    const renderers = (data.renderers ??= []);
    renderers.push(function (data) {
      if (isOpenAPI(this.page.data)) {
        data.pageProps.full ??= true;
      }
      return data;
    });
  }

  return {
    name: "core:openapi",
    init() {
      this.adapters.push(adapter(options));
      initRenderers((this.data["core:docs-layout"] ??= {}));
      initRenderers((this.data["core:notebook-layout"] ??= {}) as never);
    },
    resolvePage(page) {
      if (isOpenAPI(page.data)) return false;
    },
    async createPages({ createPage, createLayout }) {
      const { server } = options;
      const renderMode = this.mode === "dynamic" ? "dynamic" : "static";

      createLayout({
        path: "/(openapi)",
        render: renderMode,
        async component({ children }) {
          const payload: PayloadObject = {};
          for (const [schemaId, schema] of Object.entries(await server.getSchemas())) {
            payload[schemaId] = { bundled: schema.bundled, proxyUrl: server.options.proxyUrl };
          }
          return <PayloadProvider payload={JSON.stringify(payload)}>{children}</PayloadProvider>;
        },
      });

      const staticPaths: string[][] = [];

      if (renderMode === "static") {
        for (const page of (await this.getLoader()).getPages()) {
          if (!isOpenAPI(page.data)) continue;
          staticPaths.push(page.locale ? [page.locale, ...page.slugs] : page.slugs);
        }
      }

      createPage({
        render: renderMode,
        path: this.i18nConfig ? "/[lang]/(openapi)/[...slugs]" : "/(openapi)/[...slugs]",
        staticPaths,
        component: async ({ slugs, lang }) => {
          const source = await this.getLoader();
          const page = source.getPage(slugs, lang);
          if (!page || !isOpenAPI(page.data)) unstable_notFound();

          return <this.layouts.page slugs={slugs} page={page} ctx={this} />;
        },
      });
    },
  };
}

function adapter<C extends ConfigContext>(options: OpenAPIOptions): Adapter<C> {
  return {
    async "core:render-body"(page) {
      if (isOpenAPI(page.data)) {
        const ClientAPIPage =
          options.ClientAPIPage ?? (await import("@/components/openapi")).default;
        const props = page.data.getAPIPageProps();

        return <WithPayload schemaId={props.document} Comp={ClientAPIPage} props={props} />;
      }
    },
    "core:render-toc"(page) {
      if (isOpenAPI(page.data)) {
        return page.data.toc;
      }
    },
    "core:get-structured-data"(page) {
      if (isOpenAPI(page.data)) return page.data.structuredData;
    },
  };
}

/** @internal */
function isOpenAPI(data: object): data is OpenAPIPageData {
  return "getAPIPageProps" in data && typeof data.getAPIPageProps === "function";
}

/**
 * Note: the name `openapiPlugin` was originally taken by `fumadocs-openapi/server`, so this is provided to avoid conflicts in import names.
 */
export { openapiLoaderPlugin };
