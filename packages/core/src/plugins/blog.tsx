import { createBlogLayout, createBlogLayoutPage } from "@/layouts/blog";
import { createBlogIndexPage } from "@/layouts/blog.index";
import { createBlogTagPage, createBlogTagsPage } from "@/layouts/blog.tags";
import { joinPathname } from "@/lib/pathname";
import { AppShape, type AppContext } from "@/app/context";
import { getAuthorIds, groupTagsI18n } from "@/lib/shared/blog";
import { AsyncLocalStorage } from "node:async_hooks";
import type { FC, ReactNode } from "react";
import { PressPlugin } from "@/app/plugin";

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
      const { indexPath, tagsPath } = blogCtx;
      const index = layouts.index ?? createBlogIndexPage<C>();
      const tags = tagsPath !== false && {
        path: tagsPath,
        TagsPage: layouts.tags ?? createBlogTagsPage<C>(),
        TagPage: layouts.tag ?? createBlogTagPage<C>(),
        grouped: await groupTagsI18n(
          this,
          (await this.getLoader()).getPages().filter(isBlog.bind(this)),
        ),
      };

      createInterceptor((next) => blogContext.run(blogCtx, next));

      for (const lang of this.i18nConfig?.languages ?? [undefined]) {
        createLayout({ path: "/(blog)", lang, component: Layout });

        if (indexPath !== false) {
          createPage({ path: joinPathname("(blog)", indexPath), lang, component: index });
        }

        if (tags) {
          createPage({ path: joinPathname("(blog)", tags.path), lang, component: tags.TagsPage });
          createPage({
            path: joinPathname("(blog)", tags.path, "[tag]"),
            lang,
            staticPaths: Array.from(tags.grouped.get(lang ?? "")?.keys() ?? []),
            component: tags.TagPage,
          });
        }
      }
    },
  };
}
