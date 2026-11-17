import type { Plugin } from "../core/plugin";
import { searchIndexPath } from "../core/routes";
import type { SearchEntry } from "../core/search";

/**
 * The search index of each language as a data route: the browser loads it on the first search and searches it itself,
 * so search works on static hosting. It is a file with static content, a response on demand with a dynamic source.
 */
export function searchPlugin(): Plugin {
  return {
    name: "core:search",
    layoutProps: ({ lang }) => ({
      search: { enabled: true, options: { type: "static", api: searchIndexPath(lang) } },
    }),
    routes({ createApi }) {
      for (const lang of this.languages) {
        createApi({
          path: searchIndexPath(lang),
          render: this.getContentRender(),
          data: (): Promise<SearchEntry[]> =>
            Promise.all(
              this.getPages(lang).map(async (page) => {
                const [data, structuredData] = await Promise.all([
                  this.getPageData(page),
                  this.getPageStructuredData(page),
                ]);
                return {
                  url: page.url,
                  title: data.title ?? page.url,
                  description: data.description,
                  structuredData,
                };
              }),
            ),
        });
      }
    },
  };
}
