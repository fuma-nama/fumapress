import type { ConfigContext } from "@/config";
import { createBlogLayout, createBlogLayoutPage } from "@/layouts/blog";
import { createBlogIndexPage } from "@/layouts/blog.index";
import { createBlogTagPage, createBlogTagsPage } from "@/layouts/blog.tags";
import { joinPathname } from "@/lib/pathname";
import { type AppContext } from "@/lib/shared";
import { groupTags, groupTagsI18n } from "@/lib/shared/blog";
import type { ServerPlugin } from "@/lib/types";
import { AsyncLocalStorage } from "node:async_hooks";
import type { FC, ReactNode } from "react";

export interface BlogPluginOptions<C extends ConfigContext = ConfigContext> {
  /** default to checking from `page.type` */
  isBlog?: (this: AppContext<C>, page: C["page"]) => boolean;
  paths?: {
    /**
     * pathname for index page
     *
     * @default "/blog"
     */
    index?: string | false;

    /**
     * pathname for tags page
     *
     * @default "/blog/tags"
     */
    tags?: string | false;
  };

  layouts?: {
    /** shared layout for blog */
    layout?: BlogLayout<C>;

    /** renderer of blog posts (displayed inside `layout`) */
    page?: BlogLayoutPage<C>;

    /** renderer of index page (displayed inside `layout`) */
    index?: BlogIndexPage<C>;

    /** renderer of tags page (displayed inside `layout`) */
    tags?: BlogTagsPage<C>;

    /** renderer of tag page (displayed inside `layout`) */
    tag?: BlogTagPage<C>;
  };
}

export interface BlogContext<C extends ConfigContext = ConfigContext> {
  indexPath: string | false;
  tagsPath: string | false;
  isBlog: (this: AppContext<C>, page: C["page"]) => boolean;
}

const blogContext = new AsyncLocalStorage({
  name: "fumapress:blog",
});

export function getBlogContext<C extends ConfigContext = ConfigContext>(): BlogContext<C> {
  const store = blogContext.getStore();

  if (!store)
    throw new Error(
      "[Fumapress] Missing blog context for Fumapress, make sure the blog plugin is configured",
    );
  return store as BlogContext<C>;
}

export type BlogLayoutPage<C extends ConfigContext = ConfigContext> = FC<{
  lang?: string;
  slugs: string[];
  page: C["page"];
}> & { $ctx?: C };

export type BlogLayout<C extends ConfigContext = ConfigContext> = FC<{
  lang?: string;
  children: ReactNode;
}> & { $ctx?: C };

export type BlogIndexPage<C extends ConfigContext = ConfigContext> = FC<{
  lang?: string;
}> & { $ctx?: C };

export type BlogTagsPage<C extends ConfigContext = ConfigContext> = FC<{
  lang?: string;
}> & { $ctx?: C };

export type BlogTagPage<C extends ConfigContext = ConfigContext> = FC<{
  lang?: string;
  tag: string;
}> & { $ctx?: C };

export function blogPlugin<C extends ConfigContext = ConfigContext>({
  paths = {},
  isBlog = (page) => page.type === "blog",
  layouts = {},
}: BlogPluginOptions<C> = {}): ServerPlugin<C> {
  const blogCtx: BlogContext<C> = {
    indexPath: paths.index ?? "/blog",
    tagsPath: paths.tags ?? "/blog/tags",
    isBlog,
  };

  const Layout = layouts.layout ?? createBlogLayout<C>();
  const Page = layouts.page ?? createBlogLayoutPage<C>();

  return {
    name: "core:blog",
    renderPage({ page, lang, slugs }) {
      if (!isBlog.call(this, page)) return;

      return (
        <Layout lang={lang}>
          <Page lang={lang} slugs={slugs} page={page} />
        </Layout>
      );
    },
    async createPages({ createPage, createLayout, createInterceptor }) {
      const renderMode = this.mode === "default" ? "static" : this.mode;
      const source = await this.getLoader();
      const blogPages = source.getPages().filter(isBlog.bind(this));

      createInterceptor((next) => blogContext.run(blogCtx, next));

      createLayout({
        render: renderMode,
        path: this.i18nConfig ? "/[lang]/(blog)" : "/(blog)",
        component: Layout,
      });

      if (blogCtx.indexPath !== false) {
        const IndexPage = layouts.index ?? createBlogIndexPage<C>();

        createPage({
          render: renderMode,
          path: this.i18nConfig
            ? (joinPathname("/[lang]/(blog)", blogCtx.indexPath) as "/[lang]")
            : (joinPathname("/(blog)", blogCtx.indexPath) as "/[lang]"),
          staticPaths: this.i18nConfig ? this.i18nConfig.languages : [],
          component: IndexPage,
        });
      }

      if (this.i18nConfig && blogCtx.tagsPath !== false) {
        const TagsPage = layouts.tags ?? createBlogTagsPage<C>();
        const TagPage = layouts.tag ?? createBlogTagPage<C>();

        createPage({
          path: joinPathname("/[lang]/(blog)", blogCtx.tagsPath) as "/[lang]",
          render: renderMode,
          staticPaths: this.i18nConfig.languages,
          component: TagsPage,
        });

        const groupedTags = await groupTagsI18n(this, blogPages);
        const staticPaths: [string, string][] = [];
        for (const [locale, tags] of groupedTags) {
          for (const tag of tags.keys()) {
            staticPaths.push([locale, tag]);
          }
        }

        createPage({
          path: joinPathname("/[lang]/(blog)", blogCtx.tagsPath, "[tag]") as "/[lang]/[tag]",
          render: renderMode,
          staticPaths,
          component: TagPage,
        });
      } else if (blogCtx.tagsPath !== false) {
        const TagsPage = layouts.tags ?? createBlogTagsPage<C>();
        const TagPage = layouts.tag ?? createBlogTagPage<C>();

        createPage({
          path: joinPathname("/(blog)", blogCtx.tagsPath) as "/",
          render: renderMode,
          staticPaths: [],
          component: TagsPage as FC,
        });

        const grouped = await groupTags(this, blogPages);

        createPage({
          path: joinPathname("/(blog)", blogCtx.tagsPath, "[tag]") as "/[tag]",
          render: renderMode,
          staticPaths: Array.from(grouped.keys()),
          component: TagPage,
        });
      }
    },
  };
}
