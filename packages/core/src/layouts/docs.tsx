import type { ConfigContext, Layouts } from "@/config";
import {
  AppContext,
  baseLayoutProps,
  createTransformChildren,
  getGitHubFileUrl,
  getLastModifiedDate,
  mergeLayoutConfigs,
  renderBody,
  renderPageMeta,
  renderToc,
  TransformChildren,
} from "@/lib/shared";
import type { Awaitable } from "@/lib/types";
import type { Page } from "fumadocs-core/source";
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
import type { ReactNode } from "react";

export interface DocsLayoutOptions<C extends ConfigContext = ConfigContext> {
  inherit?: {
    layoutProps?: boolean;
  };

  render?: (
    this: AppContext<C> & { lang?: string },
    page: C["loaderConfig"]["page"],
  ) => Awaitable<{
    markdownUrl?: string;
    lastModified?: Date | null;
    body?: ReactNode;
    layoutProps?: Partial<TransformChildren<DocsLayoutProps>>;
    pageProps?: TransformChildren<DocsPageProps>;
  }>;
}

export interface DocsLayoutRenderData {
  markdownUrl?: string;
  lastModified?: Date | null;
  body: ReactNode;
  layoutProps: TransformChildren<DocsLayoutProps>;
  pageProps: TransformChildren<DocsPageProps>;
}

export interface DocsLayoutContextData {
  renderers?: ((
    this: { page: Page },
    data: DocsLayoutRenderData,
  ) => Awaitable<DocsLayoutRenderData>)[];
}

export function createDocsLayoutPage<C extends ConfigContext = ConfigContext>({
  render,
  inherit: { layoutProps: inheritLayoutProps = true } = {},
}: DocsLayoutOptions<NoInfer<C>> = {}): Layouts<C>["page"] {
  const TDocsLayout = createTransformChildren(DocsLayout);
  const TDocsPage = createTransformChildren(DocsPage);

  return async function Layout({ lang, page, ctx }) {
    const {
      getLoader,
      layouts,
      data: { "core:docs-layout": layoutData },
    } = ctx;
    const source = await getLoader();

    const inherited = inheritLayoutProps
      ? await layouts.defaultProps?.call(ctx, { lang })
      : undefined;
    const _raw = await render?.call(ctx, page);
    const layoutProps = mergeLayoutConfigs(
      baseLayoutProps(ctx),
      inherited,
      _raw?.layoutProps as DocsLayoutProps,
    );
    layoutProps.tree ??= source.getPageTree(lang);

    let result: DocsLayoutRenderData = {
      ..._raw,
      lastModified: _raw?.lastModified ?? (await getLastModifiedDate(ctx, page)),
      pageProps: {
        ..._raw?.pageProps,
        toc: _raw?.pageProps?.toc ?? (await renderToc(ctx, page)),
      },
      body:
        _raw?.body ??
        (await renderBody(
          ctx,
          page,
          "[Fumapress] Please specify the `render` option in createDocsLayoutPage()",
        )),
      layoutProps,
    };

    if (layoutData?.renderers) {
      const renderCtx = { page };
      for (const r of layoutData.renderers) {
        result = await r.call(renderCtx, result);
      }
    }

    return (
      <TDocsLayout props={result.layoutProps}>
        {renderPageMeta(page, ctx)}
        <TDocsPage props={result.pageProps}>
          <DocsTitle>{page.data.title}</DocsTitle>
          <DocsDescription className="mb-0">{page.data.description}</DocsDescription>
          <div className="flex flex-row gap-2 items-center border-b pt-2 pb-6">
            {result.markdownUrl && <MarkdownCopyButton markdownUrl={result.markdownUrl} />}
            <ViewOptionsPopover
              markdownUrl={result.markdownUrl}
              githubUrl={page.absolutePath ? getGitHubFileUrl(ctx, page.absolutePath) : undefined}
            />
          </div>
          <DocsBody>{result.body}</DocsBody>
          {result.lastModified && <PageLastUpdate date={result.lastModified} />}
        </TDocsPage>
      </TDocsLayout>
    );
  };
}
