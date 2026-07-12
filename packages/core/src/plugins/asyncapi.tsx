import type { DocsLayoutContextData } from "@/layouts/docs";
import type { PressPlugin } from "@/app/plugin";
import type { AppShape } from "@/app/context";
import type { Adapter } from "@/lib/types";
import type { FC } from "react";
import type { AsyncAPIPageData, AsyncAPIServer } from "@fumadocs/asyncapi/server";
import type { AsyncAPIPageProps } from "@fumadocs/asyncapi/ui";
import { asyncapiTranslations } from "@fumadocs/asyncapi/i18n";

export interface OpenAPIOptions {
  server: AsyncAPIServer;

  /** do not add the loader plugin for OpenAPI integration */
  disableLoaderPlugin?: boolean;

  /** must be a client component */
  ClientAPIPage?: FC<AsyncAPIPageProps>;
}

/**
 * this will register the OpenAPI adapter & required layout configs.
 */
export function asyncapiPlugin<C extends AppShape>(options: OpenAPIOptions): PressPlugin<C> {
  const { server, disableLoaderPlugin = false } = options;

  function initTransformers(data: DocsLayoutContextData<C>) {
    const transformers = (data.transformers ??= []);
    transformers.push(({ data, page }) => {
      if (isAsyncAPI(page.data)) {
        data.pageProps.full ??= true;
      }
      return data;
    });
  }

  return {
    name: "core:openapi",
    init() {
      this.adapters.push(adapter(options));
      initTransformers((this.data["core:docs-layout"] ??= {}));
      initTransformers((this.data["core:notebook-layout"] ??= {}) as DocsLayoutContextData<C>);

      if (this.translationsConfig) {
        this.translationsConfig.extend(asyncapiTranslations());
      }
    },
    configureLoader(options) {
      if (!disableLoaderPlugin) {
        options.plugins ??= [];
        options.plugins.push(server.loaderPlugin());
      }

      return options;
    },
  };
}

function adapter<C extends AppShape>(options: OpenAPIOptions): Adapter<C> {
  return {
    async "core:get-body"(page) {
      if (isAsyncAPI(page.data)) {
        const ClientAPIPage =
          options.ClientAPIPage ?? (await import("@/components/asyncapi")).default;
        const props = page.data.getAsyncAPIPageProps();

        return { node: <ClientAPIPage {...props} /> };
      }
    },
    "core:render-toc"(page) {
      if (isAsyncAPI(page.data)) {
        return page.data.toc;
      }
    },
    "core:get-structured-data"(page) {
      if (isAsyncAPI(page.data)) return page.data.structuredData;
    },
  };
}

function isAsyncAPI(data: object): data is AsyncAPIPageData {
  return "getAsyncAPIPageProps" in data && typeof data.getAsyncAPIPageProps === "function";
}
