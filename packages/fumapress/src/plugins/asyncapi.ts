import type { AppShape, Plugin } from "@fumapress/core";
import * as Fumadocs from "@fumadocs/asyncapi/plugin";

export { AsyncAPIPage, type AsyncAPIPluginOptions } from "@fumadocs/asyncapi/plugin";

export function asyncapiPlugin<C extends AppShape = AppShape>(
  options: Fumadocs.AsyncAPIPluginOptions,
): Plugin<C> {
  return { ...Fumadocs.asyncapiPlugin(options), name: "core:asyncapi" };
}
