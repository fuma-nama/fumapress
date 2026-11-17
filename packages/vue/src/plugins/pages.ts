import type { Plugin } from "../core/plugin";
import { PAGE_DATA_ROUTE, pageDataParam, pageOfDataParam, siteDataPath } from "../core/routes";
import type { SiteData, SiteI18n } from "../core/types";

/**
 * The data routes the app renders from: the data of the site in each language, shared by its pages, and the content
 * of each page. They are files with static content, and responses on demand with a dynamic source.
 */
export function pagesPlugin(translations: Record<string, Record<string, string>> = {}): Plugin {
  return {
    name: "core:pages",
    routes({ createApi }) {
      const { i18n } = this;

      const i18nOf = (lang: string): SiteI18n | undefined => {
        if (!i18n) return;
        const { displayName: _, ...texts } = translations[lang] ?? {};
        return {
          locale: lang,
          defaultLanguage: i18n.defaultLanguage,
          hideLocale: i18n.hideLocale ?? "never",
          locales: i18n.languages.map((code) => ({
            locale: code,
            name: translations[code]?.displayName ?? code,
          })),
          translations: texts,
        };
      };

      for (const lang of this.languages) {
        createApi({
          path: siteDataPath(lang),
          render: this.getContentRender(),
          shared: true,
          data: async (): Promise<SiteData> => ({
            site: { name: this.site.name, description: this.site.description },
            layout: await this.getLayoutProps({ lang }),
            tree: this.getPageTree(lang),
            i18n: i18nOf(lang),
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
