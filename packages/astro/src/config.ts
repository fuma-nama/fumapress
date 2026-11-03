import type { ComponentType, ReactNode } from "react";
import type { DocsPageData, PressConfig, SlotName } from "@fumapress/core";
import type * as PageTree from "fumadocs-core/page-tree";
import type { UseSearchReturn } from "fumadocs-core/search/client";
import type { _Internal } from "fumadocs-core/source";
import type { SharedProps } from "fumadocs-ui/components/dialog/search";
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

/** the config of the site in `press.config.tsx`, the `this` of its callbacks is the `Context` of `@fumapress/core` */
export function defineConfig<
  I extends _Internal.AnyInput,
  Lang extends string | undefined = undefined,
>(config: PressConfig<I, Lang>): PressConfig<I, Lang> {
  return config;
}

/** the props of the component in the `page` module */
export interface DocsPageProps {
  tree: PageTree.Root;
  page: DocsPageData;
  /** `defaultLayoutProps` of the config */
  layout: Omit<BaseLayoutProps, "children">;
  /** the UI of plugins in the slots of the page, `body.wrapper` is around `children` and `layout.wrapper` around the page */
  slots: Partial<Record<Exclude<SlotName, "body.wrapper" | "layout.wrapper">, ReactNode>>;
  /** the body of the page */
  children: ReactNode;
}

/** the exports of the `layout` module */
export interface LayoutModule {
  /** wraps the children of the root provider in layouts, for UI on every page like WebMCP */
  Provider?: ComponentType<{ children: ReactNode }>;
  /** your own search dialog, it replaces the default */
  SearchDialog?: ComponentType<SharedProps>;
  /** the search hook of the default dialog, like `useAlgoliaSearch()` */
  useSearch?: (options: { locale?: string }) => UseSearchReturn;
}
