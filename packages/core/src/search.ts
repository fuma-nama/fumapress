import type { UseSearchReturn } from "fumadocs-core/search/client";
import type { AdvancedIndex, SearchAPI } from "fumadocs-core/search/server";
import type { Context } from "./context";
import type { AppShape, ClientHook, LangEnv, Plugin } from "./plugin";
import { useServerSearch } from "./search.client";

/** the `search` capability: the provider hook the runtime composes with the Fumadocs dialog, `usePressSearch()` returns its result */
export interface SearchPluginAPI {
  /** the hook on a site, which can depend on its mode and base path */
  client: (ctx: Context) => ClientHook<UseSearchReturn, any>;
}

const path = "/api/search";

/**
 * Search with an engine at `/api/search`: in `static` mode, the exported index searched in the browser with `useIndex`,
 * a search server in the other modes.
 */
export function searchPlugin<C extends AppShape>(
  name: string,
  useIndex: (props: { from: string } & LangEnv<AppShape>) => UseSearchReturn,
  createServer: (ctx: Context<C>) => SearchAPI,
): Plugin<C, { provides: "search" }> {
  return {
    name,
    provides: ["search"],
    api: {
      client: (ctx) =>
        ctx.mode === "static"
          ? { hook: useIndex, props: { from: ctx.withBase(path) } }
          : { hook: useServerSearch, props: { api: ctx.withBase(path) } },
    },
    routes() {
      const server = createServer(this);
      if (this.mode === "static")
        return [{ path, render: "static", GET: () => server.staticGET() }];
      return [{ path, render: "dynamic", GET: (request) => server.GET(request) }];
    },
  };
}

/** the search index of a page from `getPageStructuredData()` of its content source, `plugin` names the search plugin in errors */
export function buildIndexDefault<C extends AppShape>(plugin: string) {
  return async function (this: Context<C>, page: C["page"]): Promise<AdvancedIndex> {
    const structuredData = await this.getPageStructuredData(page);
    if (!structuredData)
      throw new Error(`[Fumapress] Please specify the \`buildIndex\` option to ${plugin}()`);

    return {
      id: page.url,
      title: page.data.title ?? page.path,
      description: page.data.description,
      url: page.url,
      structuredData,
    };
  };
}
