import { type AppContext, type AppShape, getPressContext, deepmerge } from "@/app/context";
import { type Interceptor, renderWithInterceptors } from "@/lib/interceptors";
import type { Awaitable } from "@/lib/types";
import { DocsLayout, type DocsLayoutProps } from "fumadocs-ui/layouts/docs";
import {
  MarkdownCopyButton,
  ViewOptionsPopover,
  DocsPage,
  DocsTitle,
  DocsDescription,
  DocsBody,
  type DocsPageProps,
  PageLastUpdate,
} from "fumadocs-ui/layouts/docs/page";
import type { ComponentProps, ReactNode } from "react";

export interface DocsLayoutOptions<C extends AppShape = AppShape> {
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
    layoutProps?: Partial<DocsLayoutProps>;
    pageProps?: Partial<DocsPageProps>;
  }>;

  /** props/renderer for `<DocsLayout />` */
  renderLayout?: DocsInterceptor<C, DocsLayoutProps>;

  /** props/renderer for `<DocsPage />` */
  renderPage?: DocsInterceptor<C, DocsPageProps>;

  /** props/renderer for `<DocsBody />` */
  renderBody?: DocsInterceptor<C, ComponentProps<"div">>;
}

export interface DocsLayoutRenderData {
  markdownUrl?: string;
  lastModified?: Date | null;
  body: ReactNode;
  layoutProps: DocsLayoutProps;
  pageProps: DocsPageProps;
}

export type DocsInterceptor<S extends AppShape, T> = Interceptor<
  S,
  T,
  { lang?: string; page: S["page"] }
>;

export interface DocsLayoutContextData<S extends AppShape = AppShape> {
  transformers?: ((opts: {
    page: S["page"];
    data: DocsLayoutRenderData;
  }) => Awaitable<DocsLayoutRenderData>)[];

  pageInterceptors?: DocsInterceptor<S, DocsPageProps>[];
  layoutInterceptors?: DocsInterceptor<S, DocsLayoutProps>[];
  bodyInterceptors?: DocsInterceptor<S, ComponentProps<"div">>[];
}

export function createDocsLayoutPage<C extends AppShape = AppShape>({
  render,
  renderLayout,
  renderPage,
  renderBody,
  inherit: { layoutProps: inheritLayoutProps = true } = {},
}: DocsLayoutOptions<NoInfer<C>> = {}) {
  return async function Layout({
    lang,
    page,
  }: {
    lang?: string;
    slugs: string[];
    page: C["page"];
  }) {
    const ctx = getPressContext<C>();
    const { bodyInterceptors, layoutInterceptors, pageInterceptors, transformers } =
      ctx.data["core:docs-layout"] ?? {};
    const source = await ctx.getLoader();

    const _raw = await render?.call(ctx, page);
    const layoutProps: DocsLayoutProps = {
      tree: source.getPageTree(lang),
      ...deepmerge(
        inheritLayoutProps ? await ctx.defaultLayoutProps({ lang }) : undefined,
        _raw?.layoutProps,
      ),
    };

    const body = _raw?.body ?? (await ctx.getPageBody(page))?.node;
    if (body == null) {
      throw new Error("[Fumapress] Please specify the `render` option in createDocsLayoutPage()");
    }

    let result: DocsLayoutRenderData = {
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
      (props) => <DocsLayout {...props} />,
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
