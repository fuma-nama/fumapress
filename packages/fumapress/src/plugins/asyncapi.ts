import type { AppShape } from "@/app/context";
import type { PressPlugin } from "@/app/plugin";
import * as Fumadocs from "@fumadocs/asyncapi/plugin";

export { AsyncAPIPage, type AsyncAPIPluginOptions } from "@fumadocs/asyncapi/plugin";

/** @deprecated use `AsyncAPIPluginOptions` */
export interface OpenAPIOptions extends Fumadocs.AsyncAPIPluginOptions {}

export function asyncapiPlugin<C extends AppShape = AppShape>(
  options: Fumadocs.AsyncAPIPluginOptions,
): PressPlugin<C> {
  return { ...Fumadocs.asyncapiPlugin(options), name: "core:asyncapi" };
}
