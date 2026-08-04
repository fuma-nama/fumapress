import { type AppContext, type AppShape, getPressContext, deepmerge } from "@/app/context";
import { type Interceptor, renderWithInterceptors } from "@/lib/interceptors";
import type { Awaitable } from "@/lib/types";
import { GlassLayout, type GlassLayoutProps } from "fumadocs-ui/layouts/glass";
import {
  MarkdownCopyButton,
  ViewOptionsPopover,
  DocsPage,
  DocsTitle,
  DocsDescription,
  DocsBody,
  type DocsPageProps,
  PageLastUpdate,
} from "fumadocs-ui/layouts/glass/page";
import type { ComponentProps, ReactNode } from "react";

export interface GlassLayoutOptions<C extends AppShape = AppShape> {
  inherit?: {
    layoutProps?: boolean;
  };

  render?: (
    this: AppContext<C> & { lang?: string },
    page: C["page"],
  ) => Awaitable<{
    markdownUrl?: string;
    lastModified?: Date | null;
    body?: ReactNode;
    layoutProps?: Partial<GlassLayoutProps>;
    pageProps?: Partial<DocsPageProps>;
  }>;

  /** props/renderer for `<GlassLayout />` */
  renderLayout?: GlassInterceptor<C, GlassLayoutProps>;

  /** props/renderer for `<DocsPage />` */
  renderPage?: GlassInterceptor<C, DocsPageProps>;

  /** props/renderer for `<DocsBody />` */
  renderBody?: GlassInterceptor<C, ComponentProps<"div">>;
}

export interface GlassLayoutRenderData {
  markdownUrl?: string;
  lastModified?: Date | null;
  body: ReactNode;
  layoutProps: GlassLayoutProps;
  pageProps: DocsPageProps;
}

export type GlassInterceptor<S extends AppShape, T> = Interceptor<
  S,
  T,
  { lang?: string; page: S["page"] }
>;

export interface GlassLayoutContextData<S extends AppShape = AppShape> {
  transformers?: ((opts: {
    page: S["page"];
    data: GlassLayoutRenderData;
  }) => Awaitable<GlassLayoutRenderData>)[];

  pageInterceptors?: GlassInterceptor<S, DocsPageProps>[];
  layoutInterceptors?: GlassInterceptor<S, GlassLayoutProps>[];
  bodyInterceptors?: GlassInterceptor<S, ComponentProps<"div">>[];
}

export function createGlassLayoutPage<C extends AppShape = AppShape>({
  render,
  renderLayout,
  renderPage,
  renderBody,
  inherit: { layoutProps: inheritLayoutProps = true } = {},
}: GlassLayoutOptions<NoInfer<C>> = {}) {
  return async function Layout({
    lang,
    page,
  }: {
    lang?: string;
    slugs: string[];
    page: C["page"];
  }) {
    const ctx = getPressContext<C>();
    const {
      getLoader,
      data: { "core:glass-layout": layoutData },
    } = ctx;
    const { bodyInterceptors, layoutInterceptors, pageInterceptors, transformers } =
      layoutData ?? {};
    const source = await getLoader();

    const _raw = await render?.call(ctx, page);
    const inherited = inheritLayoutProps ? await ctx.defaultLayoutProps({ lang }) : undefined;
    const layoutProps: GlassLayoutProps = {
      tree: source.getPageTree(lang),
      ...deepmerge(inherited, _raw?.layoutProps),
    };

    const body = _raw?.body ?? (await ctx.getPageBody(page))?.node;
    if (body == null) {
      throw new Error("[Fumapress] Please specify the `render` option in createGlassLayoutPage()");
    }

    let result: GlassLayoutRenderData = {
      ..._raw,
      lastModified: _raw?.lastModified ?? (await ctx.getPageLastModified(page)),
      pageProps: {
        ..._raw?.pageProps,
        toc: _raw?.pageProps?.toc ?? (await ctx.getPageToc(page)),
      },
      body,
      layoutProps,
    };

    if (transformers) {
      for (const r of transformers) {
        result = await r({ data: result, page });
      }
    }

    const Layout = renderWithInterceptors(
      ctx,
      { lang, page },
      (props) => <GlassLayout {...props} />,
      [...(layoutInterceptors ?? []), renderLayout],
    );
    const Page = renderWithInterceptors(ctx, { lang, page }, (props) => <DocsPage {...props} />, [
      ...(pageInterceptors ?? []),
      renderPage,
    ]);
    const Body = renderWithInterceptors(ctx, { lang, page }, (props) => <DocsBody {...props} />, [
      ...(bodyInterceptors ?? []),
      renderBody,
    ]);

    return Layout({
      ...result.layoutProps,
      children: (
        <>
          {ctx.renderPageMeta(page)}
          {Page({
            ...result.pageProps,
            children: (
              <>
                <DocsTitle>{page.data.title}</DocsTitle>
                <DocsDescription className="mb-0">{page.data.description}</DocsDescription>
                <div className="flex flex-row gap-2 items-center border-b pt-2 pb-6">
                  {result.markdownUrl && <MarkdownCopyButton markdownUrl={result.markdownUrl} />}
                  <ViewOptionsPopover
                    markdownUrl={result.markdownUrl}
                    githubUrl={
                      page.absolutePath ? await ctx.getFileUrl(page.absolutePath) : undefined
                    }
                  />
                </div>
                {Body({ children: result.body })}
                {result.lastModified && <PageLastUpdate date={result.lastModified} />}
              </>
            ),
          })}
        </>
      ),
    });
  };
}
