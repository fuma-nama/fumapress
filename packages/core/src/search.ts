import type { ApiRoute, BuildMode } from "fumadocs-core/framework/plugin";
import type { AdvancedIndex, SearchAPI } from "fumadocs-core/search/server";
import type { Context } from "./context";
import type { AppShape } from "./plugin";

/** the API of search plugins, from `this.getProvider("search")?.api` */
export interface SearchPluginAPI {
  /** the format of the index at `/api/search` in `static` mode, the browser searches it with the client of the engine */
  staticIndex?: "flexsearch" | "orama";
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

/** a static index for search in the browser in `static` mode, a search server in the others */
export function searchRoute(mode: BuildMode, server: SearchAPI): ApiRoute {
  if (mode === "static")
    return { path: "/api/search", render: "static", GET: () => server.staticGET() };

  return { path: "/api/search", render: "dynamic", GET: (request) => server.GET(request) };
}
