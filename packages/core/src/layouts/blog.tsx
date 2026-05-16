import type { ConfigContext, Layouts } from "@/config";
import {
  type AppContext,
  createTransformChildren,
  getCreationDate,
  mergeLayoutConfigs,
  renderBody,
  renderPageMeta,
  renderToc,
  TransformChildren,
} from "@/lib/shared";
import type { Awaitable } from "@/lib/types";
import type { Page } from "fumadocs-core/source";
import { TOCItemType } from "fumadocs-core/toc";
import { HomeLayout, type HomeLayoutProps } from "fumadocs-ui/layouts/home";
import type { ReactNode } from "react";
import { unstable_notFound } from "waku/router/server";
import { createBlogIndexPage, type BlogIndexPage } from "./blog.index";
import { Link } from "waku";
import { cn } from "@/lib/cn";
import { buttonVariants } from "fumadocs-ui/components/ui/button";
import { CornerLeftUpIcon, TagIcon } from "lucide-react";
import { BlogPanel, BlogProvider } from "@/components/blog-panel";
import { getTags } from "@/lib/shared/blog";

export interface BlogLayoutOptions<C extends ConfigContext = ConfigContext> {
  /** the base directory of blog posts (in the virtual file system of `loader()` API) */
  dir?: string;
  /** The pathname of index page */
  indexPath?: string;
  /** The renderer component of index page */
  indexPage?: BlogIndexPage<C>;
  /** renderer for normal blog pages */
  render?: (
    this: AppContext<C>,
    page: C["loaderConfig"]["page"],
  ) => Awaitable<Partial<BlogLayoutRenderData>>;
}

export interface BlogLayoutRenderData {
  creationDate?: Date;
  toc: TOCItemType[];
  body: ReactNode;
  layoutProps: TransformChildren<HomeLayoutProps>;
}

export interface BlogLayoutContextData {
  renderers?: ((
    this: { page: Page },
    data: BlogLayoutRenderData,
  ) => Awaitable<BlogLayoutRenderData>)[];
}

export function createBlogLayout<C extends ConfigContext = ConfigContext>({
  render,
  dir = "blog",
  indexPage: IndexPage = createBlogIndexPage(),
  indexPath = "/" +
    dir
      .split("/")
      .filter((v) => v.length > 0)
      .join("/"),
}: BlogLayoutOptions<NoInfer<C>> = {}): Layouts<C>["page"] {
  const THomeLayout = createTransformChildren(HomeLayout);

  return async function Layout(props) {
    const {
      slugs,
      lang,
      getLoader,
      siteConfig,
      layouts,
      data: { "core:blog-layout": layoutData },
    } = props;
    const source = await getLoader();
    const page = source.getPage(slugs, lang);
    if (!page) unstable_notFound();

    async function getLayoutProps(
      overrides?: TransformChildren<HomeLayoutProps>,
    ): Promise<TransformChildren<HomeLayoutProps>> {
      const { name, git } = siteConfig;
      const inherit = await layouts.defaultProps?.call(props, page!);

      return mergeLayoutConfigs(
        {
          githubUrl: git ? `https://github.com/${git.user}/${git.repo}` : undefined,
          nav: {
            title: name,
          },
        },
        inherit,
        overrides,
      );
    }

    const _raw = await render?.call(props, page);
    let result: BlogLayoutRenderData = {
      toc: _raw?.toc ?? (await renderToc(props, page)) ?? [],
      creationDate: _raw?.creationDate ?? (await getCreationDate(props, page)),
      body:
        _raw?.body ??
        (await renderBody(
          props,
          page,
          "[Fumapress] Please specify the `render` option in createBlogLayout()",
        )),
      layoutProps: await getLayoutProps(_raw?.layoutProps),
    };

    if (layoutData?.renderers) {
      const renderCtx = { page };
      for (const r of layoutData.renderers) {
        result = await r.call(renderCtx, result);
      }
    }

    if (page.url === indexPath) {
      return (
        <THomeLayout props={result.layoutProps}>
          {renderPageMeta(page, props)}

          <main className="flex flex-col w-full max-w-[1400px] flex-1 px-4 pt-6 pb-20 mx-auto">
            <IndexPage {...props} blogDir={dir} indexPage={page} lang={page.locale} />
          </main>
        </THomeLayout>
      );
    }

    const tags = await getTags(props, page);

    return (
      <THomeLayout props={result.layoutProps}>
        {renderPageMeta(page, props)}

        <main className="flex flex-col w-full max-w-[1400px] flex-1 px-4 pt-6 pb-20 mx-auto">
          <BlogProvider toc={result.toc}>
            <div className="flex flex-col gap-4 items-center border px-4 pt-3.5 pb-6 bg-fd-secondary text-fd-secondary-foreground max-sm:-mx-4">
              <div className="flex flex-row items-center gap-2 w-full max-w-[900px]">
                <Link
                  to={indexPath}
                  className={cn(
                    buttonVariants({
                      variant: "ghost",
                      className: "text-fd-muted-foreground gap-2",
                    }),
                  )}
                >
                  <CornerLeftUpIcon className="size-3.5" />
                  Back to Home
                </Link>
              </div>
              <h1 className="font-semibold text-2xl w-full max-w-[900px]">{page.data.title}</h1>
              <p className="text-fd-muted-foreground w-full max-w-[900px]">
                {page.data.description}
              </p>
              {tags && tags.length > 0 && (
                <div className="flex flex-row items-center gap-2 flex-wrap w-full max-w-[900px] text-sm text-fd-primary-foreground font-mono">
                  <TagIcon className="size-4 text-fd-muted-foreground" />

                  {tags?.map((t) => (
                    <p key={t} className="px-1.5 py-0.5 rounded-lg bg-fd-primary">
                      {t}
                    </p>
                  ))}
                </div>
              )}
            </div>
            <article className="prose mt-6 mx-auto w-full max-w-[900px]">{result.body}</article>

            <BlogPanel />
          </BlogProvider>
        </main>
      </THomeLayout>
    );
  };
}
