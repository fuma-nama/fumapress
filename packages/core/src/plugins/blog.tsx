import type { ConfigContext } from "@/config";
import { createBlogLayout, createBlogLayoutPage } from "@/layouts/blog";
import { createBlogIndexPage } from "@/layouts/blog.index";
import { createBlogTagPage, createBlogTagsPage } from "@/layouts/blog.tags";
import { joinPathname } from "@/lib/join-pathname";
import { type AppContext } from "@/lib/shared";
import { groupTags, groupTagsI18n } from "@/lib/shared/blog";
import type { ServerPlugin } from "@/lib/types";
import type { ComponentType, ReactNode } from "react";
import { unstable_notFound } from "waku/router/server";

export interface BlogPluginOptions<C extends ConfigContext = ConfigContext> {
  /** default to checking from `page.type` */
  isBlog?: (this: AppContext<C>, page: C["loaderConfig"]["page"]) => boolean;
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

export interface BlogContext<C extends ConfigContext> {
  indexPath: string | false;
  tagsPath: string | false;
  isBlog: (this: AppContext<C>, page: C["loaderConfig"]["page"]) => boolean;
}

export type BlogLayoutPage<C extends ConfigContext = ConfigContext> = ComponentType<{
  lang?: string;
  slugs: string[];
  page: C["loaderConfig"]["page"];
  blog: BlogContext<C>;
  ctx: AppContext<C>;
}>;

export type BlogLayout<C extends ConfigContext = ConfigContext> = ComponentType<{
  lang?: string;
  children: ReactNode;
  blog: BlogContext<C>;
  ctx: AppContext<C>;
}>;

export type BlogIndexPage<C extends ConfigContext = ConfigContext> = ComponentType<{
  lang?: string;
  blog: BlogContext<C>;
  ctx: AppContext<C>;
}>;

export type BlogTagsPage<C extends ConfigContext = ConfigContext> = ComponentType<{
  lang?: string;
  blog: BlogContext<C>;
  ctx: AppContext<C>;
}>;

export type BlogTagPage<C extends ConfigContext = ConfigContext> = ComponentType<{
  lang?: string;
  tag: string;
  blog: BlogContext<C>;
  ctx: AppContext<C>;
}>;

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

  return {
    async createPages({ createPage, createLayout }) {
      const renderMode = this.mode === "dynamic" ? "dynamic" : "static";
      const source = await this.getLoader();
      const blogPages: C["loaderConfig"]["page"][] = [];

      for (const page of source.getPages()) {
        if (!isBlog.call(this, page)) continue;

        blogPages.push(page);
        this.markResolved(page);
      }

      const Layout = layouts.layout ?? createBlogLayout<C>();
      const Page = layouts.page ?? createBlogLayoutPage<C>();
      if (this.i18nConfig) {
        createLayout({
          render: renderMode,
          path: "/[lang]/(blog)",
          component: ({ lang, children }) => {
            return (
              <Layout lang={lang} blog={blogCtx} ctx={this}>
                {children}
              </Layout>
            );
          },
        });

        createPage({
          render: renderMode,
          path: "/[lang]/(blog)/[...slugs]",
          staticPaths: blogPages.map((page) => [page.locale!, ...page.slugs]),
          component: async ({ slugs, lang }) => {
            const source = await this.getLoader();
            const page = source.getPage(slugs, lang);
            if (!page || !isBlog.call(this, page)) unstable_notFound();

            return <Page lang={lang} slugs={slugs} blog={blogCtx} page={page} ctx={this} />;
          },
        });

        if (blogCtx.indexPath !== false) {
          const IndexPage = layouts.index ?? createBlogIndexPage<C>();

          createPage({
            render: renderMode,
            path: joinPathname("/[lang]/(blog)", blogCtx.indexPath) as "/[lang]",
            staticPaths: Object.keys(this.i18nConfig.languages),
            component: ({ lang }) => {
              return <IndexPage lang={lang} blog={blogCtx} ctx={this} />;
            },
          });
        }

        if (blogCtx.tagsPath !== false) {
          const TagsPage = layouts.tags ?? createBlogTagsPage<C>();
          const TagPage = layouts.tag ?? createBlogTagPage<C>();

          createPage({
            path: joinPathname("/[lang]/(blog)", blogCtx.tagsPath) as "/[lang]",
            render: renderMode,
            staticPaths: Object.keys(this.i18nConfig.languages),
            component: ({ lang }) => {
              return <TagsPage lang={lang} blog={blogCtx} ctx={this} />;
            },
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
            component: ({ lang, tag }) => {
              return <TagPage lang={lang} tag={tag} blog={blogCtx} ctx={this} />;
            },
          });
        }
      } else {
        createLayout({
          render: renderMode,
          path: "/(blog)",
          component: ({ children }) => {
            return (
              <Layout blog={blogCtx} ctx={this}>
                {children}
              </Layout>
            );
          },
        });

        createPage({
          render: renderMode,
          path: "/(blog)/[...slugs]",
          staticPaths: blogPages.map((page) => page.slugs),
          component: async ({ slugs }) => {
            const source = await this.getLoader();
            const page = source.getPage(slugs);
            if (!page || !isBlog.call(this, page)) unstable_notFound();

            return <Page blog={blogCtx} slugs={slugs} page={page} ctx={this} />;
          },
        });

        if (blogCtx.indexPath !== false) {
          const IndexPage = layouts.index ?? createBlogIndexPage<C>();

          createPage({
            render: renderMode,
            path: joinPathname("/(blog)", blogCtx.indexPath) as "/",
            staticPaths: [],
            component: () => {
              return <IndexPage blog={blogCtx} ctx={this} />;
            },
          });
        }

        if (blogCtx.tagsPath !== false) {
          const TagsPage = layouts.tags ?? createBlogTagsPage<C>();
          const TagPage = layouts.tag ?? createBlogTagPage<C>();

          createPage({
            path: joinPathname("/(blog)", blogCtx.tagsPath) as "/",
            render: renderMode,
            staticPaths: [],
            component: () => {
              return <TagsPage blog={blogCtx} ctx={this} />;
            },
          });

          const grouped = await groupTags(this, blogPages);

          createPage({
            path: joinPathname("/(blog)", blogCtx.tagsPath, "[tag]") as "/[tag]",
            render: renderMode,
            staticPaths: Array.from(grouped.keys()),
            component: ({ tag }) => {
              return <TagPage tag={tag} blog={blogCtx} ctx={this} />;
            },
          });
        }
      }
    },
  };
}
