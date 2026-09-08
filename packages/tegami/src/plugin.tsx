import { localeRoutes, withLang, type AppShape, type PressPlugin } from "fumapress";
import type { AppContext } from "fumapress";
import type { FC, ReactNode } from "react";
import { changelogContext, type ChangelogContext } from "./context.ts";
import { joinPathname } from "./lib/pathname.ts";
import { createChangelogIndexPage, createChangelogLayout } from "./components/layouts.tsx";

export { getChangelogContext } from "./context.ts";
export type { ChangelogContext } from "./context.ts";

export interface ChangelogPluginOptions<C extends AppShape = AppShape> {
  /** default to checking from `page.type` */
  isChangelog?: (this: AppContext<C>, page: C["page"]) => boolean;
  paths?: {
    /**
     * pathname for index page
     *
     * @default "/changelog"
     */
    index?: string | false;
  };
  layouts?: {
    /** shared layout for changelog */
    layout?: ChangelogLayout<C>;
    /** renderer of index page (displayed inside `layout`) */
    index?: ChangelogIndexPage<C>;
  };
}

export type ChangelogLayout<C extends AppShape = AppShape> = FC<{
  lang?: string;
  children: ReactNode;
}> & { $ctx?: C };

export type ChangelogIndexPage<C extends AppShape = AppShape> = FC<{
  lang?: string;
}> & { $ctx?: C };

export function changelogPlugin<C extends AppShape = AppShape>({
  paths = {},
  isChangelog = (page) => page.type === "changelog",
  layouts = {},
}: ChangelogPluginOptions<C> = {}): PressPlugin<C> {
  const changelogCtx: ChangelogContext<C> = {
    indexPath: paths.index ?? "/changelog",
    isChangelog,
  };

  const Layout = layouts.layout ?? createChangelogLayout<C>();

  return {
    name: "tegami:changelog",
    async createPages({ createPage, createLayout, createInterceptor }) {
      const renderMode = this.mode === "default" ? "static" : this.mode;
      const { indexPath } = changelogCtx;
      const index = indexPath !== false && {
        path: indexPath,
        Page: layouts.index ?? createChangelogIndexPage<C>(),
      };

      createInterceptor((next) => changelogContext.run(changelogCtx, next));

      const routes: { base: string; lang?: string }[] = this.i18nConfig
        ? localeRoutes(this.i18nConfig)
        : [{ base: "/" }];

      for (const { base, lang } of routes) {
        const group = joinPathname(base, "(changelog)");

        createLayout({
          render: renderMode,
          path: group,
          component: lang ? withLang(Layout, lang) : Layout,
        });

        if (index) {
          createPage({
            render: renderMode,
            path: joinPathname(group, index.path) as "/",
            staticPaths: [],
            component: (lang ? withLang(index.Page, lang) : index.Page) as FC,
          });
        }
      }
    },
  };
}
