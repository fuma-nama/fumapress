import type { ConfigContext } from "@/config";
import type { DocsLayoutContextData } from "@/layouts/docs";
import type { Awaitable, ServerPlugin } from "@/lib/types";
import type { Adapter } from "@/lib/types";
import type { OpenAPIPageData, OpenAPIServer } from "fumadocs-openapi/server";
import type { FC } from "react";
import { isFullPathname, resolveBaseUrl } from "@/lib/pathname";
import { openapiTranslations } from "fumadocs-openapi/i18n";
import type { OpenAPIPageProps } from "fumadocs-openapi/ui";

export interface OpenAPIOptions {
  server: OpenAPIServer;

  /** do not add the loader plugin for OpenAPI integration */
  disableLoaderPlugin?: boolean;

  /** must be a client component */
  ClientAPIPage?: FC<OpenAPIPageProps>;

  /**
   * Create proxy server.
   *
   * By default, it will create one when `proxyUrl` is specified in `createOpenAPI()`.
   */
  createProxy?: boolean | (() => Awaitable<ReturnType<OpenAPIServer["createProxy"]>>);
}

/**
 * this will register the OpenAPI adapter & required layout configs.
 */
export function openapiPlugin<C extends ConfigContext>(options: OpenAPIOptions): ServerPlugin<C> {
  const { server, disableLoaderPlugin = false } = options;

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

      if (this.translationsConfig) {
        this.translationsConfig.extend(openapiTranslations());
      }
    },
    configureLoader(options) {
      if (!disableLoaderPlugin) {
        options.plugins ??= [];
        options.plugins.push(server.loaderPlugin());
      }

      return options;
    },
    async createPages({ createApi }) {
      const proxyUrl = server.options.proxyUrl;
      const { createProxy = typeof proxyUrl === "string" && isFullPathname(proxyUrl) } = options;

      if (createProxy) {
        if (!proxyUrl)
          throw new Error(
            `[Fumapress] The "proxyUrl" option in createOpenAPI() is required to create proxy server`,
          );
        if (this.mode === "static")
          throw new Error(`[Fumapress] static mode is not compatible with proxy server`);

        const proxy =
          typeof createProxy === "function" ? await createProxy() : server.createProxy();

        createApi({
          path: proxyUrl,
          render: "dynamic",
          handlers: {
            all: proxy.handle,
          },
        });
      }
    },
  };
}

function adapter<C extends ConfigContext>(options: OpenAPIOptions): Adapter<C> {
  return {
    async "core:render-body"(page) {
      if (isOpenAPI(page.data)) {
        const ClientAPIPage =
          options.ClientAPIPage ?? (await import("@/components/openapi")).default;
        const { payload, ...props } = page.data.getOpenAPIPageProps();

        return (
          <ClientAPIPage
            payload={{
              ...payload,
              proxyUrl:
                payload.proxyUrl && isFullPathname(payload.proxyUrl)
                  ? resolveBaseUrl(import.meta.env.BASE_URL, payload.proxyUrl)
                  : payload.proxyUrl,
            }}
            {...props}
          />
        );
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

function isOpenAPI(data: object): data is OpenAPIPageData {
  return "getAPIPageProps" in data && typeof data.getAPIPageProps === "function";
}
