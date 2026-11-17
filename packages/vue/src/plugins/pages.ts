import type { SingularTranslationsAPI, TranslationsAPI } from "fumadocs-core/i18n";
import { directionOf } from "../core/i18n";
import { siteI18n } from "../core/translations";
import type { Plugin } from "../core/plugin";
import { PAGE_DATA_ROUTE, pageDataParam, pageOfDataParam, siteDataPath } from "../core/routes";
import type { SiteData } from "../core/types";

/**
 * The data routes the app renders from: the data of the site in each language, shared by its pages, and the content
 * of each page. They are files with static content, and responses on demand with a dynamic source.
 */
export function pagesPlugin(translations?: TranslationsAPI | SingularTranslationsAPI): Plugin {
  return {
    name: "core:pages",
    routes({ createApi }) {
      for (const lang of this.languages) {
        createApi({
          path: siteDataPath(lang),
          render: this.getContentRender(),
          shared: true,
          data: async (): Promise<SiteData> => ({
            layoutProps: await this.getLayoutProps({ lang }),
            site: { name: this.site.name, description: this.site.description },
            tree: this.getPageTree(lang),
            i18n: siteI18n(this.i18n, translations, lang),
            dir: directionOf(lang),
          }),
        });
      }

      createApi({
        path: PAGE_DATA_ROUTE,
        render: "static",
        staticPaths: async () => (await this.getStaticPages()).map(pageDataParam),
        data: ({ params }) => {
          const url = pageOfDataParam(params.path ?? "");
          return url === undefined ? undefined : this.getContent(url);
        },
      });
    },
  };
}
