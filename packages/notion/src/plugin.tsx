import { createNotionFileUrlResolver } from "@fumadocs/notion/file";
import * as Fumadocs from "@fumadocs/notion/press";
import type { NotionRendererProps } from "@fumadocs/notion/renderer";
import type { AppShape, Plugin } from "@fumapress/core";
import type { ComponentType } from "react";
import { isNotionPageData, type NotionIntegration } from "./source";

/** @deprecated use `fileProxy` of `NotionPluginOptions` of `@fumadocs/notion/press` */
export interface NotionFileProxyOptions extends Exclude<
  Fumadocs.NotionPluginOptions["fileProxy"],
  boolean | undefined
> {}

/** @deprecated use `NotionPluginOptions` of `@fumadocs/notion/press` */
export interface NotionPluginOptions extends Omit<Fumadocs.NotionPluginOptions, "notion"> {
  /** Replace the default semantic block renderer. */
  Renderer?: ComponentType<NotionRendererProps>;
}

/** @deprecated use `notionPlugin()`, the default export of `@fumadocs/notion/press` */
export function notionPlugin<C extends AppShape = AppShape>(
  integration: NotionIntegration,
  { fileProxy = true, Renderer, ...options }: NotionPluginOptions = {},
): Plugin<C> {
  const filePath =
    typeof fileProxy === "object" ? normalizeProxyPath(fileProxy.path) : "/api/notion/file";
  const plugin = Fumadocs.default({
    ...options,
    notion: integration,
    fileProxy: typeof fileProxy === "object" ? { path: filePath } : fileProxy,
  });
  if (!Renderer) return plugin;

  return {
    ...plugin,
    async getPageBody({ data }) {
      if (!isNotionPageData(data)) return;
      const { parent } = data.notion;
      if (
        parent.type !== "data_source_id" ||
        !sameNotionId(parent.data_source_id, integration.dataSourceId)
      )
        return;

      return {
        node: (
          <Renderer
            {...options}
            blocks={(await data.load()).blocks}
            getFileUrl={
              fileProxy
                ? createNotionFileUrlResolver({ pageId: data.id, path: this.withBase(filePath) })
                : undefined
            }
          />
        ),
      };
    },
  };
}

function normalizeProxyPath(value = "/api/notion/file"): string {
  const path = value.startsWith("/") ? value : `/${value}`;
  if (/[?#]/.test(path)) {
    throw new Error("[@fumapress/notion] fileProxy.path cannot include a query or hash");
  }
  return path.length > 1 ? path.replace(/\/+$/, "") : path;
}

function sameNotionId(a: string, b: string): boolean {
  return a.replaceAll("-", "").toLowerCase() === b.replaceAll("-", "").toLowerCase();
}
