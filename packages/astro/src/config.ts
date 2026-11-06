import * as core from "@fumapress/core";
import type {
  AppShape,
  ContentOptions,
  InferAppShape,
  Press,
  PressContent,
  PressPageType,
  RenderPageProps,
} from "@fumapress/core";
import type { _Internal } from "fumadocs-core/source";
import type { ReactNode } from "react";
import type { layoutRootKeys } from "./ui/layout-root";

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

export type {
  AppShape,
  BaseOptions,
  Plugin,
  PressContext,
  ProviderProps,
  RenderPageProps,
  UIOptions,
} from "@fumapress/core";
export { recommendedPreset } from "@fumapress/core";

type OmitEach<P, K extends PropertyKey> = P extends unknown ? Omit<P, K> : never;
type PickEach<P, K extends PropertyKey> = P extends unknown ? Pick<P, Extract<keyof P, K>> : never;

/** `type Props = LayoutProps<typeof app, "docs">` of an `.astro` file from `ui.renderPage`; its `<slot />` is the page content */
export type LayoutProps<
  A extends Press<any, any>,
  K extends PressPageType<A> = PressPageType<A>,
> = OmitEach<RenderPageProps<A, K>, "body" | "children" | "renderDefault"> & {
  /** the data of the page for its React root, pass it as it is: `<DocsRoot client:load island={island}>` */
  island: string;
};

/**
 * The props of the React root from `createIsland()`: what the site resolved for the page, `children` is its default slot.
 * The layout passes it the rest, like the frontmatter of `page` and the props of plugin views.
 */
export type IslandProps<
  A extends Press<any, any>,
  K extends PressPageType<A> = PressPageType<A>,
> = PickEach<RenderPageProps<A, K>, (typeof layoutRootKeys)[number]> & { children?: ReactNode };
