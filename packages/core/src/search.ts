import type { ComponentType } from "react";
import type { AdvancedIndex, SearchAPI } from "fumadocs-core/search/server";
import type { SharedProps } from "fumadocs-ui/components/dialog/search";
import type { Context } from "./context";
import type { AppShape, Plugin } from "./plugin";
import { FetchSearchDialog } from "./search.client";

const path = "/api/search";

/**
 * Search with an engine at `/api/search`, with its dialog in the root provider: in `static` mode, the exported index
 * searched in the browser by `StaticDialog`, a search server in the other modes.
 */
export function searchPlugin<C extends AppShape>(
  name: string,
  StaticDialog: ComponentType<SharedProps & { from?: string; locale?: string }>,
  createServer: (ctx: Context<C>) => SearchAPI,
): Plugin<C, { provides: "search" }> {
  return {
    name,
    provides: ["search"],
    providerProps({ lang }) {
      const url = this.withBase(path);
      return {
        search:
          this.mode === "static"
            ? { SearchDialog: StaticDialog, options: { from: url, locale: lang } }
            : { SearchDialog: FetchSearchDialog, options: { api: url, locale: lang } },
      };
    },
    apiRoutes() {
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
