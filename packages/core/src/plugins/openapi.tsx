import { type OpenAPIAdapterOptions, fumadocsOpenAPI, isOpenAPI } from "@/adapters/openapi";
import type { ConfigContext } from "@/config";
import type { DocsLayoutContextData } from "@/layouts/docs";
import type { ServerPlugin } from "@/lib/types";
import { openapiPlugin as openapiLoaderPlugin } from "fumadocs-openapi/server";

export type OpenAPIOptions = OpenAPIAdapterOptions;

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
    init() {
      this.adapters.push(fumadocsOpenAPI(options));
      initRenderers((this.data["core:docs-layout"] ??= {}));
      initRenderers((this.data["core:notebook-layout"] ??= {}) as never);
    },
  };
}

/**
 * Note: the name `openapiPlugin` was originally taken by `fumadocs-openapi/server`, so this is provided to avoid conflicts in import names.
 */
export { openapiLoaderPlugin };
