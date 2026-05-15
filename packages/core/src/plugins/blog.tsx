import type { ConfigContext } from "@/config";
import { createBlogIndexPage } from "@/layouts/blog.index";
import type { AppContext } from "@/lib/shared";
import type { ServerPlugin } from "@/lib/types";
import type { ComponentType } from "react";

export interface BlogPluginOptions<C extends ConfigContext = ConfigContext> {
  /** path of index page, default to `/blog` */
  indexPath?: string;
  /** component of index page */
  indexPage?: ComponentType<AppContext<C> & { lang?: string }>;
}

export function blogPlugin<C extends ConfigContext = ConfigContext>(
  options: BlogPluginOptions<C> = {},
): ServerPlugin<C> {
  const Component = options.indexPage ?? createBlogIndexPage<C>();
  const indexPath = options.indexPath ?? "/blog";

  return {
    createPages({ createPage }) {
      const renderMode = this.mode === "dynamic" ? "dynamic" : "static";

      if (this.i18nConfig) {
        createPage({
          path: `/[lang]${indexPath}`,
          staticPaths: Object.keys(this.i18nConfig.languages),
          render: renderMode,
          component: ({ lang }) => {
            return <Component lang={lang} {...this} />;
          },
        });
      } else {
        createPage({
          path: indexPath as "/",
          render: renderMode,
          staticPaths: [],
          component: () => {
            return <Component {...this} />;
          },
        });
      }
    },
  };
}
