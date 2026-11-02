import * as Fumadocs from "@fumadocs/notion/plugin";
import type { AppShape, PressPlugin } from "fumapress";
import type { NotionIntegration } from "./source";

/** @deprecated use `fileProxy` of `NotionPluginOptions` of `@fumadocs/notion/plugin` */
export interface NotionFileProxyOptions extends Exclude<
  Fumadocs.NotionPluginOptions["fileProxy"],
  boolean | undefined
> {}

/** @deprecated use `NotionPluginOptions` of `@fumadocs/notion/plugin` */
export interface NotionPluginOptions extends Fumadocs.NotionPluginOptions {}

/** @deprecated use `notionPlugin()` of `@fumadocs/notion/plugin` */
export function notionPlugin<C extends AppShape = AppShape>(
  integration: NotionIntegration,
  { fileProxy, ...options }: NotionPluginOptions = {},
): PressPlugin<C> {
  return Fumadocs.notionPlugin(integration, {
    ...options,
    fileProxy:
      typeof fileProxy === "object" ? { path: normalizeProxyPath(fileProxy.path) } : fileProxy,
  });
}

function normalizeProxyPath(value = "/api/notion/file"): string {
  const path = value.startsWith("/") ? value : `/${value}`;
  if (/[?#]/.test(path)) {
    throw new Error("[@fumapress/notion] fileProxy.path cannot include a query or hash");
  }
  return path.length > 1 ? path.replace(/\/+$/, "") : path;
}
