import {
  createFromSource,
  type AdvancedIndex,
  type AdvancedOptions,
} from "fumadocs-core/search/server";
import type { Context } from "../context";
import type { AppShape, Awaitable, Plugin } from "../plugin";
import { buildIndexDefault, searchRoute, type SearchPluginAPI } from "../search";

export interface OramaSearchOptions<
  C extends AppShape = AppShape,
  Ctx extends Context<C> = Context<C>,
> extends Omit<AdvancedOptions, "indexes"> {
  /** the search index of a page, from `getPageStructuredData()` by default */
  buildIndex?: (this: Ctx, page: C["page"]) => Awaitable<AdvancedIndex>;
}

/**
 * Search with the built-in Orama engine at `/api/search`.
 *
 * In `static` mode, it exports the index for search in the browser, the other modes search on the server.
 */
export function oramaSearchPlugin<
  C extends AppShape = AppShape,
  Ctx extends Context<C> = Context<C>,
>({
  buildIndex = buildIndexDefault<C>("oramaSearchPlugin"),
  ...options
}: OramaSearchOptions<NoInfer<C>, NoInfer<Ctx>> = {}): Plugin<C, Ctx> {
  return {
    name: "core:orama-search",
    provides: ["search"],
    api: { staticIndex: "orama" } satisfies SearchPluginAPI,
    routes() {
      const server = createFromSource(() => this.getLoader(), {
        ...options,
        buildIndex: (page) => buildIndex.call(this, page),
      });
      return [searchRoute(this.mode, server)];
    },
  };
}
