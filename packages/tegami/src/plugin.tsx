import type { AppShape, PressPlugin } from "fumapress";
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
      const { indexPath } = changelogCtx;
      createInterceptor((next) => changelogContext.run(changelogCtx, next));
      createLayout({ path: "/(changelog)", component: Layout });

      if (indexPath !== false) {
        createPage({
          path: joinPathname("(changelog)", indexPath),
          component: layouts.index ?? createChangelogIndexPage<C>(),
        });
      }
    },
  };
}
