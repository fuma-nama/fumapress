import { createBlogLayout, createBlogLayoutPage } from "@/layouts/blog";
import { createBlogIndexPage } from "@/layouts/blog.index";
import { createBlogTagPage, createBlogTagsPage } from "@/layouts/blog.tags";
import { joinPathname } from "@/lib/pathname";
import {
  AppShape,
  getPressContext,
  renderLinks,
  type AppContext,
  type PageAlternate,
} from "@/app/context";
import { decodeSlug, getAuthorIds, groupTagsI18n } from "@/lib/shared/blog";
import { localeRoutes, withLang } from "@/lib/i18n";
import { AsyncLocalStorage } from "node:async_hooks";
import type { FC, ReactNode } from "react";
import { PressPlugin } from "@/app/plugin";
import { asMarkdown } from "@/markdown";
import type { Awaitable } from "@/lib/types";

export { tagSlug } from "@/lib/shared/blog";

export interface BlogAuthor {
  name: string;
  /** role or job title */
  title?: string;
  /** link to profile or website */
  url?: string;
  /** avatar URL */
  image?: string;
}

export interface BlogPluginOptions<C extends AppShape = AppShape> {
  /** default to checking from `page.type` */
  isBlog?: (this: AppContext<C>, page: C["page"]) => boolean;

  /** author registry, keyed by the ids used in posts */
  authors?: Record<string, BlogAuthor>;

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
  authors: Record<string, BlogAuthor>;
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

export interface BlogPost<C extends AppShape = AppShape> {
  page: C["page"];
  /** creation date, from `core:get-creation-date` */
  date?: Date;
}

async function toPost<C extends AppShape>(
  ctx: AppContext<C>,
  page: C["page"],
): Promise<BlogPost<C>> {
  return { page, date: await ctx.getPageCreatedAt(page) };
}

/** blog posts of a locale, newest first (posts without a date come first) */
export async function getBlogPosts<C extends AppShape>(
  ctx: AppContext<C>,
  lang?: string,
): Promise<BlogPost<C>[]> {
  const { isBlog } = getBlogContext<C>();
  const source = await ctx.getLoader();
  const pending: Promise<BlogPost<C>>[] = [];

  for (const page of source.getPages(lang)) {
    if (isBlog.call(ctx, page)) pending.push(toPost(ctx, page));
  }

  const posts = await Promise.all(pending);
  const now = Date.now();
  return posts.sort((a, b) => (b.date?.getTime() ?? now) - (a.date?.getTime() ?? now));
}

/** authors of a post, ids missing from the `authors` option are shown by name only */
export async function getBlogAuthors<C extends AppShape>(
  ctx: AppContext<C>,
  page: C["page"],
): Promise<BlogAuthor[]> {
  const { authors } = getBlogContext<C>();
  const ids = await getAuthorIds(ctx, page);
  const result: BlogAuthor[] = [];
  for (const id of ids ?? []) result.push(authors[id] ?? { name: id });
  return result;
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
  /** tag slug from the URL */
  tag: string;
}> & { $ctx?: C };

export function blogPlugin<C extends AppShape = AppShape>({
  paths = {},
  isBlog = (page) => page.type === "blog",
  authors = {},
  layouts = {},
}: BlogPluginOptions<C> = {}): PressPlugin<C> {
  const blogCtx: BlogContext<C> = {
    indexPath: paths.index ?? "/blog",
    tagsPath: paths.tags ?? "/blog/tags",
    isBlog,
    authors,
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
      const languages = this.i18nConfig?.languages ?? [];
      const index = indexPath !== false && {
        path: indexPath,
        Page: withRouteLinks<C>(layouts.index ?? createBlogIndexPage<C>(), () => ({
          pathname: indexPath,
          locales: languages,
        })),
      };
      const tags = tagsPath !== false && {
        path: tagsPath,
        TagsPage: withRouteLinks<C>(layouts.tags ?? createBlogTagsPage<C>(), () => ({
          pathname: tagsPath,
          locales: languages,
        })),
        TagPage: withRouteLinks<C, { lang?: string; tag: string }>(
          layouts.tag ?? createBlogTagPage<C>(),
          async function ({ lang, tag }) {
            const slug = decodeSlug(tag);
            const source = await this.getLoader();
            const grouped = await groupTagsI18n(this, source.getPages().filter(isBlog.bind(this)));
            // tags without posts render on dynamic requests, but they are not real pages
            if (!grouped.get(lang ?? "")?.has(slug)) return;

            return {
              pathname: joinPathname(tagsPath, slug),
              locales: languages.filter((locale) => grouped.get(locale)?.has(slug)),
            };
          },
        ),
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

interface RouteLinks {
  /** pathname of the route, without language prefix */
  pathname: string;
  /** languages the route exists in, for `hreflang` links */
  locales: string[];
}

/**
 * Add the canonical and `hreflang` links of a route to its page, so custom `layouts` get them too.
 *
 * `resolve()` returns `undefined` for pages that should not be advertised.
 */
function withRouteLinks<C extends AppShape, P extends { lang?: string } = { lang?: string }>(
  Page: FC<P>,
  resolve: (this: AppContext<C>, props: P) => Awaitable<RouteLinks | undefined>,
): FC<P> {
  async function Links(props: P) {
    const ctx = getPressContext<C>();
    const route = await resolve.call(ctx, props);
    if (!route) return;

    const { pathname, locales } = route;
    const url = ctx.siteConfig.baseUrl
      ? ctx.absoluteUrl(ctx.localizePath(props.lang, pathname))
      : undefined;
    const alternates: PageAlternate[] = [];
    if (locales.length > 1) {
      for (const locale of locales) {
        alternates.push({
          locale,
          hreflang: ctx.siteConfig.hreflang?.[locale] ?? locale,
          href: ctx.absoluteUrl(ctx.localizePath(locale, pathname)),
        });
      }
    }

    return renderLinks(ctx, { url, alternates });
  }

  // called in place, so the Markdown renderer of llms.txt still sees its `asMarkdown()`
  return (props) => (
    <>
      {!asMarkdown() && <Links {...props} />}
      {"$$typeof" in Page ? <Page {...props} /> : Page(props)}
    </>
  );
}
