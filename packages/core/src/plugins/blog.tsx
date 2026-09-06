import { createBlogLayout, createBlogLayoutPage } from "@/layouts/blog";
import { createBlogIndexPage } from "@/layouts/blog.index";
import { createBlogTagPage, createBlogTagsPage } from "@/layouts/blog.tags";
import { joinPathname } from "@/lib/pathname";
import { AppShape, type AppContext } from "@/app/context";
import { groupTagsI18n } from "@/lib/shared/blog";
import { localeRoutes, withLang } from "@/lib/i18n";
import { AsyncLocalStorage } from "node:async_hooks";
import type { FC, ReactNode } from "react";
import { PressPlugin } from "@/app/plugin";

export interface BlogPluginOptions<C extends AppShape = AppShape> {
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

export interface BlogContext<C extends AppShape = AppShape> {
  indexPath: string | false;
  tagsPath: string | false;
  isBlog: (this: AppContext<C>, page: C["page"]) => boolean;
}

const blogContext = new AsyncLocalStorage({
  name: "fumapress:blog",
});

export function getBlogContext<C extends AppShape = AppShape>(): BlogContext<C> {
  const store = blogContext.getStore();

  if (!store)
    throw new Error(
      "[Fumapress] Missing blog context for Fumapress, make sure the blog plugin is configured",
    );
  return store as BlogContext<C>;
}

export type BlogLayoutPage<C extends AppShape = AppShape> = FC<{
  lang?: string;
  slugs: string[];
  page: C["page"];
}> & { $ctx?: C };

export type BlogLayout<C extends AppShape = AppShape> = FC<{
  lang?: string;
  children: ReactNode;
}> & { $ctx?: C };

export type BlogIndexPage<C extends AppShape = AppShape> = FC<{
  lang?: string;
}> & { $ctx?: C };

export type BlogTagsPage<C extends AppShape = AppShape> = FC<{
  lang?: string;
}> & { $ctx?: C };

export type BlogTagPage<C extends AppShape = AppShape> = FC<{
  lang?: string;
  tag: string;
}> & { $ctx?: C };

export function blogPlugin<C extends AppShape = AppShape>({
  paths = {},
  isBlog = (page) => page.type === "blog",
  layouts = {},
}: BlogPluginOptions<C> = {}): PressPlugin<C> {
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
      const { indexPath, tagsPath } = blogCtx;
      const source = await this.getLoader();
      const blogPages = source.getPages().filter(isBlog.bind(this));
      const index = indexPath !== false && {
        path: indexPath,
        Page: layouts.index ?? createBlogIndexPage<C>(),
      };
      const tags = tagsPath !== false && {
        path: tagsPath,
        TagsPage: layouts.tags ?? createBlogTagsPage<C>(),
        TagPage: layouts.tag ?? createBlogTagPage<C>(),
        grouped: await groupTagsI18n(this, blogPages),
      };

      createInterceptor((next) => blogContext.run(blogCtx, next));

      const routes: { base: string; lang?: string }[] = this.i18nConfig
        ? localeRoutes(this.i18nConfig)
        : [{ base: "/" }];

      for (const { base, lang } of routes) {
        const group = joinPathname(base, "(blog)");

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

        if (tags) {
          const { TagsPage, TagPage, grouped } = tags;

          createPage({
            render: renderMode,
            path: joinPathname(group, tags.path) as "/",
            staticPaths: [],
            component: (lang ? withLang(TagsPage, lang) : TagsPage) as FC,
          });

          createPage({
            render: renderMode,
            path: joinPathname(group, tags.path, "[tag]") as "/[tag]",
            staticPaths: Array.from(grouped.get(lang ?? "")?.keys() ?? []),
            component: lang ? withLang(TagPage, lang) : TagPage,
          });
        }
      }
    },
  };
}
