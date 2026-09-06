import { type AppContext, type AppShape, getPressContext } from "@/app/context";
import type { Awaitable } from "@/lib/types";
import type { TOCItemType } from "fumadocs-core/toc";
import type { ReactNode } from "react";
import { Link } from "@/client";
import { ChevronLeftIcon, ChevronRightIcon, TagIcon } from "lucide-react";
import { BlogPanel, BlogProvider } from "@/components/blog-panel";
import { getTags, tagSlug } from "@/lib/shared/blog";
import {
  getAdjacentPosts,
  getBlogAuthors,
  getBlogContext,
  type BlogAuthor,
  type BlogLayout,
  type BlogLayoutPage,
  type BlogPost,
} from "@/plugins/blog";
import { joinPathname } from "@/lib/pathname";
import { BlogDate, LinkToHome } from "@/components/blog";
import { createHomeLayout, type HomeLayoutOptions } from "./home";
import { cn } from "@/lib/cn";
import { T } from "@fuma-translate/react";

/** You can use `createHomeLayout()` directly, this is only a wrapper */
export function createBlogLayout<C extends AppShape>(
  options?: HomeLayoutOptions<C>,
): BlogLayout<C> {
  return createHomeLayout(options);
}

export interface BlogLayoutPageRenderData {
  creationDate?: Date;
  toc: TOCItemType[];
  body: ReactNode;
}

export interface BlogLayoutPageOptions<C extends AppShape = AppShape> {
  render?: (this: AppContext<C>, page: C["page"]) => Awaitable<Partial<BlogLayoutPageRenderData>>;
}

export function createBlogLayoutPage<C extends AppShape = AppShape>(
  options: BlogLayoutPageOptions<C> = {},
): BlogLayoutPage<C> {
  const { render } = options;

  return async function BlogLayoutPage({ page, lang }) {
    const ctx = getPressContext<C>();
    const { tagsPath } = getBlogContext<C>();
    const [tags, authors, adjacent] = await Promise.all([
      getTags(ctx, page),
      getBlogAuthors(ctx, page),
      getAdjacentPosts(ctx, page),
    ]);
    const _raw = await render?.call(ctx, page);
    const body = _raw?.body ?? (await ctx.getPageBody(page))?.node;
    if (body == null) {
      throw new Error("[Fumapress] Please specify the `render` option in createBlogLayoutPage()");
    }
    const result: BlogLayoutPageRenderData = {
      body,
      toc: _raw?.toc ?? (await ctx.getPageToc(page)) ?? [],
      creationDate: _raw?.creationDate ?? (await ctx.getPageCreatedAt(page)),
    };

    return (
      <BlogProvider toc={result.toc}>
        <div className="flex flex-col gap-4 items-center border-y px-4 pt-3.5 pb-6 bg-fd-card text-fd-card-foreground shadow-inner max-sm:-mx-4 sm:rounded-xl sm:border">
          <div className="flex flex-row items-center gap-2 w-full max-w-[900px]">
            <LinkToHome lang={lang} />
          </div>
          <h1 className="font-semibold text-2xl w-full max-w-[900px]">{page.data.title}</h1>
          <p className="text-fd-muted-foreground w-full max-w-[900px]">{page.data.description}</p>
          {(authors.length > 0 || result.creationDate) && (
            <div className="flex flex-row flex-wrap items-center gap-x-6 gap-y-2 w-full max-w-[900px]">
              {authors.map((author) => (
                <BlogAuthorItem key={author.name} author={author} />
              ))}
              {result.creationDate && (
                <BlogDate date={result.creationDate} className="text-sm text-fd-muted-foreground" />
              )}
            </div>
          )}
          {tags && tags.length > 0 && (
            <div className="flex flex-row items-center gap-2 flex-wrap w-full max-w-[900px] text-sm text-fd-primary-foreground font-mono">
              <TagIcon className="size-4 text-fd-muted-foreground" />

              {tags.map((t) => {
                if (tagsPath !== false)
                  return (
                    <Link
                      key={t}
                      href={ctx.localizePath(lang, joinPathname(tagsPath, tagSlug(t)))}
                      className="px-1.5 py-0.5 rounded-lg bg-fd-primary"
                    >
                      {t}
                    </Link>
                  );

                return (
                  <p key={t} className="px-1.5 py-0.5 rounded-lg bg-fd-primary">
                    {t}
                  </p>
                );
              })}
            </div>
          )}
        </div>
        <article className="prose mt-6 mx-auto w-full max-w-[900px]">{result.body}</article>
        {(adjacent.newer || adjacent.older) && (
          <nav className="grid gap-2 mt-8 mx-auto w-full max-w-[900px] sm:grid-cols-2">
            {adjacent.newer && (
              <AdjacentPostLink post={adjacent.newer}>
                <ChevronLeftIcon className="size-3.5" />
                <T text="Newer post" note="blog post navigation" />
              </AdjacentPostLink>
            )}
            {adjacent.older && (
              <AdjacentPostLink post={adjacent.older} className="sm:col-start-2 sm:items-end">
                <T text="Older post" note="blog post navigation" />
                <ChevronRightIcon className="size-3.5" />
              </AdjacentPostLink>
            )}
          </nav>
        )}

        <div className="h-12" />
        <BlogPanel />
      </BlogProvider>
    );
  };
}

function BlogAuthorItem({ author }: { author: BlogAuthor }) {
  const className = "inline-flex items-center gap-2 text-sm";
  const content = (
    <>
      {author.image && (
        <img
          src={author.image}
          alt=""
          width={28}
          height={28}
          loading="lazy"
          className="size-7 rounded-full"
        />
      )}
      <span className="flex flex-col leading-tight">
        <span className="font-medium">{author.name}</span>
        {author.title && <span className="text-xs text-fd-muted-foreground">{author.title}</span>}
      </span>
    </>
  );

  if (!author.url) return <span className={className}>{content}</span>;
  return (
    <a href={author.url} className={cn(className, "transition-colors hover:text-fd-primary")}>
      {content}
    </a>
  );
}

function AdjacentPostLink({
  post,
  className,
  children,
}: {
  post: BlogPost;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={post.page.url}
      className={cn(
        "flex flex-col gap-1 bg-fd-card text-fd-card-foreground rounded-xl border p-4 transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground",
        className,
      )}
    >
      <span className="inline-flex items-center gap-1 text-xs text-fd-muted-foreground">
        {children}
      </span>
      <span className="font-medium">{post.page.data.title}</span>
    </Link>
  );
}
