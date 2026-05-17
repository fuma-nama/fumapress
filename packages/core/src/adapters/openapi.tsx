import type { ConfigContext } from "@/config";
import type { Adapter } from "@/lib/types";
import type { OpenAPIPageData } from "fumadocs-openapi/server";
import type { ClientApiPageProps } from "fumadocs-openapi/ui/create-client";
import type { FC } from "react";

export interface OpenAPIAdapterOptions {
  ClientAPIPage: FC<ClientApiPageProps>;
}

export function fumadocsOpenAPI<C extends ConfigContext>(
  options: OpenAPIAdapterOptions,
): Adapter<C> {
  const { ClientAPIPage } = options;
  return {
    async "core:render-body"(page) {
      if (isOpenAPI(page.data)) {
        return <ClientAPIPage {...await page.data.getClientAPIPageProps()} />;
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
export function isOpenAPI(data: object): data is OpenAPIPageData {
  return "getAPIPageProps" in data && typeof data.getAPIPageProps === "function";
}
