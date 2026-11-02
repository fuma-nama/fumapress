import * as Fumadocs from "@fumadocs/notion/plugin";
import type { Plugin } from "fumadocs-core/framework/plugin";
import { createElement, isValidElement, type ComponentType } from "react";
import type { NotionRendererProps } from "./renderer";
import type { NotionIntegration } from "./source";

/** @deprecated use `fileProxy` of `NotionPluginOptions` of `@fumadocs/notion/plugin` */
export type NotionFileProxyOptions = Exclude<
  Fumadocs.NotionPluginOptions["fileProxy"],
  boolean | undefined
>;

/** @deprecated use `NotionPluginOptions` of `@fumadocs/notion/plugin` */
export interface NotionPluginOptions extends Fumadocs.NotionPluginOptions {
  /** Replace the default semantic block renderer, it receives the props of the default one. */
  Renderer?: ComponentType<NotionRendererProps>;
}

/** @deprecated use `notionPlugin()` of `@fumadocs/notion/plugin` */
export function notionPlugin(
  integration: NotionIntegration,
  { Renderer, fileProxy, ...options }: NotionPluginOptions = {},
): Plugin {
  const plugin = Fumadocs.notionPlugin(integration, {
    ...options,
    fileProxy:
      typeof fileProxy === "object" ? { path: normalizeProxyPath(fileProxy.path) } : fileProxy,
  });
  if (!Renderer) return plugin;

  return {
    ...plugin,
    async getPageBody(page) {
      const body = await plugin.getPageBody!.call(this, page);
      if (!body || !isValidElement<NotionRendererProps>(body.node)) return body;
      return { node: createElement(Renderer, body.node.props) };
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
