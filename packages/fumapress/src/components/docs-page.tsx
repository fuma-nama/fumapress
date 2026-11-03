import { type AppContext, type AppShape, getPressContext, deepmerge } from "@/app/context";
import { type Interceptor, renderWithInterceptors } from "@/lib/interceptors";
import { selectTreeRoot } from "@/lib/page-tree";
import type { Awaitable } from "@/lib/types";
import { renderSlot, wrapSlot } from "@fumapress/core";
import type { DocsPageProps } from "fumadocs-ui/layouts/docs/page";
import type { ComponentProps, FC, ReactNode } from "react";

/** options of a docs-like layout, with the props `L` of its layout and `P` of its page */
export interface DocsLikeLayoutOptions<C extends AppShape, L, P> {
  inherit?: {
    layoutProps?: boolean;
  };

  /** folder path to use as the root of the sidebar tree, such as the `baseDir` of a content source */
  treeRoot?: string;

  render?: (
    this: AppContext<C> & { lang?: string },
    page: C["page"],
  ) => Awaitable<{
    markdownUrl?: string;
    lastModified?: Date | null;
    body?: ReactNode;
    layoutProps?: Partial<L>;
    pageProps?: Partial<P>;
  }>;

  /** props/renderer for the layout */
  renderLayout?: DocsLikeInterceptor<C, L>;

  /** props/renderer for `<DocsPage />` */
  renderPage?: DocsLikeInterceptor<C, P>;

  /** props/renderer for `<DocsBody />` */
  renderBody?: DocsLikeInterceptor<C, ComponentProps<"div">>;

  /** props/renderer for the page actions, return `null` to hide them */
  renderPageActions?: DocsLikeInterceptor<C, PageActionsProps>;
}

export interface PageActionsProps {
  markdownUrl?: string;
  githubUrl?: string;
}

export interface DocsLikeRenderData<L, P> {
  markdownUrl?: string;
  lastModified?: Date | null;
  body: ReactNode;
  layoutProps: L;
  pageProps: P;
}

export type DocsLikeInterceptor<S extends AppShape, T> = Interceptor<
  S,
  T,
  { lang?: string; page: S["page"] }
>;

export interface DocsLikeContextData<S extends AppShape, L, P> {
  transformers?: ((opts: {
    page: S["page"];
    data: DocsLikeRenderData<L, P>;
  }) => Awaitable<DocsLikeRenderData<L, P>>)[];

  pageInterceptors?: DocsLikeInterceptor<S, P>[];
  layoutInterceptors?: DocsLikeInterceptor<S, L>[];
  bodyInterceptors?: DocsLikeInterceptor<S, ComponentProps<"div">>[];
  actionsInterceptors?: DocsLikeInterceptor<S, PageActionsProps>[];
}

/** a docs-like layout: its components from Fumadocs UI and its data in `ctx.data` */
export interface DocsLikeLayout<C extends AppShape, L, P> extends Pick<
  typeof import("fumadocs-ui/layouts/docs/page"),
  | "DocsTitle"
  | "DocsDescription"
  | "DocsBody"
  | "MarkdownCopyButton"
  | "ViewOptionsPopover"
  | "PageLastUpdate"
> {
  /** the function creating the layout, for errors */
  name: string;
  data: (ctx: AppContext<C>) => DocsLikeContextData<C, L, P> | undefined;
  DocsLayout: FC<L>;
  DocsPage: FC<P>;
}

export function createDocsLikeLayoutPage<
  C extends AppShape,
  L extends object,
  P extends Pick<DocsPageProps, "full" | "toc">,
>(
  {
    render,
    treeRoot,
    renderLayout,
    renderPage,
    renderBody,
    renderPageActions,
    inherit: { layoutProps: inheritLayoutProps = true } = {},
  }: DocsLikeLayoutOptions<C, L, P>,
  {
    name,
    data: getData,
    DocsLayout,
    DocsPage,
    DocsTitle,
    DocsDescription,
    DocsBody,
    MarkdownCopyButton,
    ViewOptionsPopover,
    PageLastUpdate,
  }: DocsLikeLayout<C, L, P>,
) {
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
      actionsInterceptors,
      bodyInterceptors,
      layoutInterceptors,
      pageInterceptors,
      transformers,
    } = getData(ctx) ?? {};
    const [source, data, slots] = await Promise.all([
      ctx.getLoader(),
      ctx.getPageData(page),
      ctx.getSlots({ page }),
    ]);

    const _raw = await render?.call(ctx, page);
    // the props of every layout extend the shared base props
    const layoutProps = {
      tree: selectTreeRoot(source.getPageTree(lang), treeRoot),
      ...(deepmerge(
        inheritLayoutProps ? await ctx.defaultLayoutProps({ lang }) : undefined,
        _raw?.layoutProps,
      ) as Partial<L>),
    } as L;

    const body = _raw?.body ?? (await ctx.getPageBody(page))?.node;
    if (body == null) {
      throw new Error(`[Fumapress] Please specify the \`render\` option in ${name}()`);
    }

    let result: DocsLikeRenderData<L, P> = {
      ..._raw,
      markdownUrl: _raw?.markdownUrl ?? data.markdownUrl,
      lastModified: _raw?.lastModified ?? data.lastModified,
      pageProps: {
        ..._raw?.pageProps,
        full: _raw?.pageProps?.full ?? data.full,
        toc: _raw?.pageProps?.toc ?? data.toc,
      } as P,
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
      (props: L) => <DocsLayout {...props} />,
      [...(layoutInterceptors ?? []), renderLayout],
    );
    const Page = renderWithInterceptors(
      ctx,
      { lang, page },
      (props: P) => <DocsPage {...props} />,
      [...(pageInterceptors ?? []), renderPage],
    );
    const Body = renderWithInterceptors(ctx, { lang, page }, (props) => <DocsBody {...props} />, [
      ...(bodyInterceptors ?? []),
      renderBody,
    ]);

    const Actions = renderWithInterceptors(
      ctx,
      { lang, page },
      ({ markdownUrl, githubUrl }: PageActionsProps) => (
        <div className="flex flex-row gap-2 items-center border-b pt-2 pb-6">
          {markdownUrl && <MarkdownCopyButton markdownUrl={markdownUrl} />}
          <ViewOptionsPopover markdownUrl={markdownUrl} githubUrl={githubUrl} />
          {renderSlot(slots["page.actions"])}
        </div>
      ),
      [...(actionsInterceptors ?? []), renderPageActions],
    );

    return Layout({
      ...result.layoutProps,
      children: Page({
        ...result.pageProps,
        children: (
          <>
            <DocsTitle>{data.title}</DocsTitle>
            <DocsDescription className="mb-0">{data.description}</DocsDescription>
            {Actions({ markdownUrl: result.markdownUrl, githubUrl: data.githubUrl })}
            {Body({ children: wrapSlot(slots["body.wrapper"], result.body) })}
            {result.lastModified && <PageLastUpdate date={result.lastModified} />}
            {renderSlot(slots["page.footer"])}
          </>
        ),
      }),
    });
  };
}
