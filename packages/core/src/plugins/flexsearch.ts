import {
  flexsearchFromSource,
  type FromSourceOptions,
  type Index,
} from "fumadocs-core/search/flexsearch";
import type { LoaderConfig } from "fumadocs-core/source";
import type { Context } from "../context";
import type { AppShape, Awaitable, Plugin } from "../plugin";
import { buildIndexDefault, searchRoute, type SearchPluginAPI } from "../search";

export interface FlexsearchOptions<
  C extends AppShape = AppShape,
  Ctx extends Context<C> = Context<C>,
> extends Omit<FromSourceOptions<LoaderConfig>, "buildIndex"> {
  /** the search index of a page, from `getPageStructuredData()` by default */
  buildIndex?: (this: Ctx, page: C["page"]) => Awaitable<Index>;
}

/**
 * Search with FlexSearch at `/api/search`, requires `flexsearch`.
 *
 * In `static` mode, it exports the index for search in the browser, the other modes search on the server.
 */
export function flexsearchPlugin<
  C extends AppShape = AppShape,
  Ctx extends Context<C> = Context<C>,
>({
  buildIndex = buildIndexDefault<C>("flexsearchPlugin"),
  ...options
}: FlexsearchOptions<NoInfer<C>, NoInfer<Ctx>> = {}): Plugin<C, Ctx> {
  return {
    name: "core:flexsearch",
    provides: ["search"],
    api: { staticIndex: "flexsearch" } satisfies SearchPluginAPI,
    routes() {
      const server = flexsearchFromSource(() => this.getLoader(), {
        ...options,
        buildIndex: (page) => buildIndex.call(this, page),
      });
      return [searchRoute(this.mode, server)];
    },
  };
}
