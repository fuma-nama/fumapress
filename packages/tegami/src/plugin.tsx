import type { ConfigContext, ServerPlugin } from "fumapress";
import type { AppContext } from "fumapress";
import { notFound, redirect } from "fumapress/router";
import type { FC, ReactNode } from "react";
import { changelogContext, type ChangelogContext } from "./context.ts";
import { joinPathname } from "./lib/pathname.ts";
import { createChangelogIndexPage, createChangelogLayout } from "./components/layouts.tsx";

export { getChangelogContext } from "./context.ts";
export type { ChangelogContext } from "./context.ts";

export interface ChangelogPluginOptions<C extends ConfigContext = ConfigContext> {
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

export type ChangelogLayout<C extends ConfigContext = ConfigContext> = FC<{
  lang?: string;
  children: ReactNode;
}> & { $ctx?: C };

export type ChangelogIndexPage<C extends ConfigContext = ConfigContext> = FC<{
  lang?: string;
}> & { $ctx?: C };

export function changelogPlugin<C extends ConfigContext = ConfigContext>({
  paths = {},
  isChangelog = (page) => page.type === "changelog",
  layouts = {},
}: ChangelogPluginOptions<C> = {}): ServerPlugin<C> {
  const changelogCtx: ChangelogContext<C> = {
    indexPath: paths.index ?? "/changelog",
    isChangelog,
  };

  const Layout = layouts.layout ?? createChangelogLayout<C>();

  return {
    name: "tegami:changelog",
    renderPage({ page, lang }) {
      if (!isChangelog.call(this, page)) return;

      // Entries live on the index; old entry URLs redirect there.
      if (changelogCtx.indexPath === false) return notFound();
      return redirect(lang ? joinPathname(lang, changelogCtx.indexPath) : changelogCtx.indexPath);
    },
    async createPages({ createPage, createLayout, createInterceptor }) {
      const renderMode = this.mode === "default" ? "static" : this.mode;

      createInterceptor((next) => changelogContext.run(changelogCtx, next));

      createLayout({
        render: renderMode,
        path: this.i18nConfig ? "/[lang]/(changelog)" : "/(changelog)",
        component: Layout,
      });

      if (changelogCtx.indexPath === false) return;

      const IndexPage = layouts.index ?? createChangelogIndexPage<C>();

      createPage({
        render: renderMode,
        path: this.i18nConfig
          ? (joinPathname("/[lang]/(changelog)", changelogCtx.indexPath) as "/[lang]")
          : (joinPathname("/(changelog)", changelogCtx.indexPath) as "/[lang]"),
        staticPaths: this.i18nConfig ? this.i18nConfig.languages : [],
        component: IndexPage,
      });
    },
  };
}
