import type { AsyncAPIPluginOptions } from "@fumadocs/asyncapi/plugin";

export {
  AsyncAPIPage,
  asyncapiPlugin,
  type AsyncAPIPluginOptions,
} from "@fumadocs/asyncapi/plugin";

/** @deprecated use `AsyncAPIPluginOptions` */
export type OpenAPIOptions = AsyncAPIPluginOptions;
