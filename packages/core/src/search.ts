import type { ComponentType } from "react";
import { getBreadcrumbItems } from "fumadocs-core/breadcrumb";
import type { AdvancedIndex, SearchAPI } from "fumadocs-core/search/server";
import type { Page } from "fumadocs-core/source";
import type { SharedProps } from "fumadocs-ui/components/dialog/search";
import type { Context } from "./context";
import type { AppShape, Plugin } from "./plugin";
import { FetchSearchDialog } from "./search.client";

/** the search server, the exported index: a file has an extension, a URL form of its own on every host */
const paths = { dynamic: "/api/search", static: "/api/search.json" };

export interface SearchRenderOptions {
  /**
   * - `static`: export the index at build time, the browser downloads and searches it.
   * - `dynamic`: search on a server.
   *
   * @defaultValue `dynamic` with a dynamic content source, `static` otherwise
   */
  render?: "static" | "dynamic";
}

/**
 * Search with an engine, with its dialog in the root provider: a static route exports the index, searched in the browser by `StaticDialog`, a dynamic one searches on the server.
 */
export function searchPlugin<C extends AppShape>(
  name: string,
  StaticDialog: ComponentType<SharedProps & { from?: string; locale?: string }>,
  createServer: (ctx: Context<C>) => SearchAPI,
  { render }: SearchRenderOptions = {},
): Plugin<C> {
  const renderOf = (ctx: Context<C>) => render ?? ctx.getContentRender();

  return {
    name,
    providerProps({ lang }) {
      const url = this.withBase(paths[renderOf(this)]);
      return {
        search:
          renderOf(this) === "static"
            ? { SearchDialog: StaticDialog, options: { from: url, locale: lang } }
            : { SearchDialog: FetchSearchDialog, options: { api: url, locale: lang } },
      };
    },
    routes({ createApi }) {
      const server = createServer(this);
      if (renderOf(this) === "static")
        createApi({ path: paths.static, render: "static", GET: () => server.staticGET() });
      else createApi({ path: paths.dynamic, GET: (request) => server.GET(request) });
    },
  };
}

/** the search index of a page from `getPageStructuredData()` of its content source, by its title without one */
export function buildIndexDefault<C extends AppShape>() {
  return async function (this: Context<C>, page: C["page"]): Promise<AdvancedIndex> {
    const structuredData = (await this.getPageStructuredData(page)) ?? {
      headings: [],
      contents: [],
    };

    const { title, description } = await this.getPageData(page);
    return { id: page.url, title, description, url: page.url, structuredData };
  };
}

/**
 * The breadcrumb of a page in results, like the one of its layout: sources of a site are folders of one tree, and a reader is inside a root folder.
 */
export async function searchBreadcrumbs(ctx: Context<any>, page: Page): Promise<string[]> {
  const tree = (await ctx.getLoader()).getPageTree(page.locale);
  const out: string[] = [];
  for (const { name } of getBreadcrumbItems(page.url, tree, { includeSeparator: true }))
    if (typeof name === "string") out.push(name);
  return out;
}
