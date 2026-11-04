import * as core from "@fumapress/core";
import type { AppShape, ContentOptions, InferAppShape, PressContent } from "@fumapress/core";
import type { _Internal } from "fumadocs-core/source";

/**
 * The site of `press.config.tsx`: `createPress(content).plugins(...).config({...})`, its default export. The `this` of its
 * callbacks is the `Context` of the site.
 */
export function createPress<
  I extends _Internal.AnyInput,
  Lang extends string | undefined = undefined,
  C extends AppShape = InferAppShape<I, Lang, "astro">,
>(content: I, options?: ContentOptions<I, Lang>): PressContent<C, {}> {
  return core.createPress(content, options);
}

export type { BuildMode } from "fumadocs-core/framework/plugin";
export type {
  AppShape,
  BaseOptions,
  GitProvider,
  PageNode,
  Plugin,
  PluginTypes,
  PressContext,
  ProviderProps,
  RenderPageProps,
  SiteConfig,
  UIOptions,
} from "@fumapress/core";
export { recommendedPreset } from "@fumapress/core";
