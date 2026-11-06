import {
  flexsearchFromSource,
  type FromSourceOptions,
  type Index,
} from "fumadocs-core/search/flexsearch";
import type { LoaderConfig } from "fumadocs-core/source";
import type { Context } from "../context";
import type { AppShape, Awaitable, Plugin } from "../plugin";
import {
  buildIndexDefault,
  searchBreadcrumbs,
  searchPlugin,
  type SearchRenderOptions,
} from "../search";
import { FlexsearchDialog } from "./flexsearch.client";

export interface FlexsearchOptions<C extends AppShape = AppShape>
  extends Omit<FromSourceOptions<LoaderConfig>, "buildIndex">, SearchRenderOptions {
  /** the search index of a page, from `getPageStructuredData()` by default */
  buildIndex?: (this: Context<C>, page: C["page"]) => Awaitable<Index>;
}

/**
 * Search with FlexSearch, requires `flexsearch`.
 *
 * A site with a server searches on it, others export the index for search in the browser. `render` chooses.
 */
export function flexsearchPlugin<C extends AppShape = AppShape>({
  buildIndex = buildIndexDefault<C>(),
  render,
  ...options
}: FlexsearchOptions<NoInfer<C>> = {}): Plugin<C, { provides: "search" }> {
  return searchPlugin<C>(
    "core:flexsearch",
    FlexsearchDialog,
    (ctx) =>
      flexsearchFromSource(() => ctx.getLoader(), {
        ...options,
        buildIndex: async (page) => ({
          breadcrumbs: await searchBreadcrumbs(ctx, page),
          ...(await buildIndex.call(ctx, page)),
        }),
      }),
    { render },
  );
}
