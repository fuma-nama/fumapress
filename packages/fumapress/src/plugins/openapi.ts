import type { AppShape } from "@/app/context";
import type { PressPlugin } from "@/app/plugin";
import * as Fumadocs from "fumadocs-openapi/plugin";

export { OpenAPIPage, type OpenAPIPluginOptions } from "fumadocs-openapi/plugin";

/** @deprecated use `OpenAPIPluginOptions` */
export interface OpenAPIOptions extends Fumadocs.OpenAPIPluginOptions {}

export function openapiPlugin<C extends AppShape = AppShape>(
  options: Fumadocs.OpenAPIPluginOptions,
): PressPlugin<C> {
  return { ...Fumadocs.openapiPlugin(options), name: "core:openapi" };
}
