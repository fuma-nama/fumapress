import type { ConfigContext } from "@/config";
import type { DocsLayoutContextData } from "@/layouts/docs";
import type { Awaitable, ServerPlugin } from "@/lib/types";
import type { Adapter } from "@/lib/types";
import type { OpenAPIPageData, OpenAPIServer } from "fumadocs-openapi/server";
import type { ClientApiPageProps } from "fumadocs-openapi/ui/create-client";
import type { FC, ReactNode } from "react";
import { PayloadObject, PayloadProvider, WithPayload } from "@/components/openapi.payload";

export interface OpenAPIOptions {
  server: OpenAPIServer;
  /** must be a client component */
  ClientAPIPage?: FC<ClientApiPageProps>;

  /** create proxy server */
  createProxy?: boolean | (() => Awaitable<ReturnType<OpenAPIServer["createProxy"]>>);
}

/**
 * this will register the OpenAPI adapter & required layout configs.
 */
export function openapiPlugin<C extends ConfigContext>(options: OpenAPIOptions): ServerPlugin<C> {
  const { server, createProxy } = options;

  function initRenderers(data: DocsLayoutContextData) {
    const renderers = (data.renderers ??= []);
    renderers.push(function (data) {
      if (isOpenAPI(this.page.data)) {
        data.pageProps.full ??= true;
      }
      return data;
    });
  }

  async function ServerPayloadProvider({ children }: { children: ReactNode }) {
    const payload: PayloadObject = {};

    for (const [schemaId, schema] of Object.entries(await server.getSchemas())) {
      payload[schemaId] = { bundled: schema.bundled, proxyUrl: server.options.proxyUrl };
    }

    return <PayloadProvider payload={JSON.stringify(payload)}>{children}</PayloadProvider>;
  }

  return {
    name: "core:openapi",
    init() {
      this.adapters.push(adapter(options));
      initRenderers((this.data["core:docs-layout"] ??= {}));
      initRenderers((this.data["core:notebook-layout"] ??= {}) as never);
    },
    renderPage({ page, slugs, lang }) {
      if (!isOpenAPI(page.data)) return;

      return (
        <ServerPayloadProvider>
          <this.layouts.page lang={lang} slugs={slugs} page={page} ctx={this} />
        </ServerPayloadProvider>
      );
    },
    async createPages({ createApi }) {
      if (createProxy) {
        const proxyUrl = server.options.proxyUrl;
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
