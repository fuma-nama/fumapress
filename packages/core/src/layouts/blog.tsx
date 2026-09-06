import { type AppContext, type AppShape, getPressContext } from "@/app/context";
import type { Awaitable } from "@/lib/types";
import type { TOCItemType } from "fumadocs-core/toc";
import type { ReactNode } from "react";
import { Link } from "@/client";
import { TagIcon } from "lucide-react";
import { BlogPanel, BlogProvider } from "@/components/blog-panel";
import { getTags } from "@/lib/shared/blog";
import { getBlogContext, type BlogLayout, type BlogLayoutPage } from "@/plugins/blog";
import { joinPathname } from "@/lib/pathname";
import { LinkToHome } from "@/components/blog";
import { createHomeLayout, type HomeLayoutOptions } from "./home";

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
    const tags = await getTags(ctx, page);
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
          {tags && tags.length > 0 && (
            <div className="flex flex-row items-center gap-2 flex-wrap w-full max-w-[900px] text-sm text-fd-primary-foreground font-mono">
              <TagIcon className="size-4 text-fd-muted-foreground" />

              {tags.map((t) => {
                if (tagsPath !== false)
                  return (
                    <Link
                      key={t}
                      href={ctx.localizePath(lang, joinPathname(tagsPath, t))}
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

        <div className="h-12" />
        <BlogPanel />
      </BlogProvider>
    );
  };
}
