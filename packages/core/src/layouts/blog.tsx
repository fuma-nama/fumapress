import type { ConfigContext } from "@/config";
import {
  type AppContext,
  getCreationDate,
  renderBody,
  renderPageMeta,
  renderToc,
} from "@/lib/shared";
import type { Awaitable } from "@/lib/types";
import type { TOCItemType } from "fumadocs-core/toc";
import type { ReactNode } from "react";
import { unstable_notFound } from "waku/router/server";
import { Link } from "waku";
import { TagIcon } from "lucide-react";
import { BlogPanel, BlogProvider } from "@/components/blog-panel";
import { getTags } from "@/lib/shared/blog";
import { createHomeLayout, type HomeLayoutOptions } from "./home";
import { BlogLayout, BlogLayoutPage } from "@/plugins/blog";
import { joinPathname } from "@/lib/join-pathname";
import { LinkToHome } from "@/components/blog";

export function createBlogLayout<C extends ConfigContext = ConfigContext>(
  options?: HomeLayoutOptions<C>,
): BlogLayout<C> {
  const HomeLayout = createHomeLayout<C>(options);

  return function BlogLayout({ children, ctx, lang }) {
    return (
      <HomeLayout lang={lang} ctx={ctx}>
        <main className="flex flex-col w-full max-w-[1400px] flex-1 px-4 pt-6 pb-20 mx-auto">
          {children}
        </main>
      </HomeLayout>
    );
  };
}

export interface BlogLayoutPageRenderData {
  creationDate?: Date;
  toc: TOCItemType[];
  body: ReactNode;
}

export interface BlogLayoutPageOptions<C extends ConfigContext = ConfigContext> {
  render?: (
    this: AppContext<C>,
    page: C["loaderConfig"]["page"],
  ) => Awaitable<Partial<BlogLayoutPageRenderData>>;
}

export function createBlogLayoutPage<C extends ConfigContext = ConfigContext>(
  options: BlogLayoutPageOptions<C> = {},
): BlogLayoutPage<C> {
  const { render } = options;

  return async function BlogLayoutPage({ slugs, ctx, blog, lang }) {
    const source = await ctx.getLoader();
    const page = source.getPage(slugs, lang);
    if (!page) unstable_notFound();

    const tags = await getTags(ctx, page);
    const _raw = await render?.call(ctx, page);
    const result: BlogLayoutPageRenderData = {
      body:
        _raw?.body ??
        (await renderBody(
          ctx,
          page,
          "[Fumapress] Please specify the `render` option in createBlogLayoutPage()",
        )),
      toc: _raw?.toc ?? (await renderToc(ctx, page)) ?? [],
      creationDate: _raw?.creationDate ?? (await getCreationDate(ctx, page)),
    };

    return (
      <BlogProvider toc={result.toc}>
        {renderPageMeta(page, ctx)}
        <div className="flex flex-col gap-4 items-center border-y px-4 pt-3.5 pb-6 bg-fd-card text-fd-card-foreground shadow-inner max-sm:-mx-4 sm:rounded-xl sm:border">
          <div className="flex flex-row items-center gap-2 w-full max-w-[900px]">
            <LinkToHome blog={blog} lang={lang} />
          </div>
          <h1 className="font-semibold text-2xl w-full max-w-[900px]">{page.data.title}</h1>
          <p className="text-fd-muted-foreground w-full max-w-[900px]">{page.data.description}</p>
          {tags && tags.length > 0 && (
            <div className="flex flex-row items-center gap-2 flex-wrap w-full max-w-[900px] text-sm text-fd-primary-foreground font-mono">
              <TagIcon className="size-4 text-fd-muted-foreground" />

              {tags.map((t) => {
                if (blog.tagsPath !== false)
                  return (
                    <Link
                      key={t}
                      to={joinPathname(lang ?? "", blog.tagsPath, t)}
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

        <BlogPanel />
      </BlogProvider>
    );
  };
}
