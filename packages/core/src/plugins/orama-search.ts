import {
  createFromSource,
  type AdvancedIndex,
  type AdvancedOptions,
} from "fumadocs-core/search/server";
import type { Context } from "../context";
import type { AppShape, Awaitable, Plugin } from "../plugin";
import {
  buildIndexDefault,
  searchBreadcrumbs,
  searchPlugin,
  type SearchRenderOptions,
} from "../search";
import { OramaSearchDialog } from "./orama-search.client";

export interface OramaSearchOptions<C extends AppShape = AppShape>
  extends Omit<AdvancedOptions, "indexes">, SearchRenderOptions {
  /** the search index of a page, from `getPageStructuredData()` by default */
  buildIndex?: (this: Context<C>, page: C["page"]) => Awaitable<AdvancedIndex>;
}

/**
 * Search with the built-in Orama engine.
 *
 * A site with a server searches on it, others export the index for search in the browser. `render` chooses.
 */
export function oramaSearchPlugin<C extends AppShape = AppShape>({
  buildIndex = buildIndexDefault<C>(),
  render,
  ...options
}: OramaSearchOptions<NoInfer<C>> = {}): Plugin<C, { provides: "search" }> {
  return searchPlugin<C>(
    "core:orama-search",
    OramaSearchDialog,
    (ctx) =>
      createFromSource(() => ctx.getLoader(), {
        ...options,
        buildIndex: async (page) => ({
          breadcrumbs: await searchBreadcrumbs(ctx, page),
          ...(await buildIndex.call(ctx, page)),
        }),
      }),
    { render },
  );
}
