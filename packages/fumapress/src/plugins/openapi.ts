import type { AppShape, Plugin } from "@fumapress/core";
import * as Fumadocs from "fumadocs-openapi/plugin";

export { OpenAPIPage, type OpenAPIPluginOptions } from "fumadocs-openapi/plugin";

export function openapiPlugin<C extends AppShape = AppShape>(
  options: Fumadocs.OpenAPIPluginOptions,
): Plugin<C> {
  return { ...Fumadocs.openapiPlugin(options), name: "core:openapi" };
}
