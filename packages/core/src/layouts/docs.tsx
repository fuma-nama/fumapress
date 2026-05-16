import type { ConfigContext, Layouts } from "@/config";
import {
  AppContext,
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
import { unstable_notFound } from "waku/router/server";

export interface DocsLayoutOptions<C extends ConfigContext = ConfigContext> {
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

export function createDocsLayout<C extends ConfigContext = ConfigContext>({
  render,
}: DocsLayoutOptions<NoInfer<C>> = {}): Layouts<C>["page"] {
  const TDocsLayout = createTransformChildren(DocsLayout);
  const TDocsPage = createTransformChildren(DocsPage);

  return async function Layout(props) {
    const {
      slugs,
      lang,
      getLoader,
      siteConfig,
      layouts,
      data: { "core:docs-layout": layoutData },
    } = props;
    const source = await getLoader();
    const page = source.getPage(slugs, lang);
    if (!page) unstable_notFound();

    async function getLayoutProps(
      overrides?: Partial<TransformChildren<DocsLayoutProps>>,
    ): Promise<TransformChildren<DocsLayoutProps>> {
      const { name, git } = siteConfig;
      const inherit = await layouts.defaultProps?.call(props, page!);

      return mergeLayoutConfigs(
        {
          tree: source.getPageTree(lang),
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
    let result: DocsLayoutRenderData = {
      ..._raw,
      lastModified: _raw?.lastModified ?? (await getLastModifiedDate(props, page)),
      pageProps: {
        ..._raw?.pageProps,
        toc: _raw?.pageProps?.toc ?? (await renderToc(props, page)),
      },
      body:
        _raw?.body ??
        (await renderBody(
          props,
          page,
          "[Fumapress] Please specify the `render` option in createDocsLayout()",
        )),
      layoutProps: await getLayoutProps(_raw?.layoutProps),
    };

    if (layoutData?.renderers) {
      const renderCtx = { page };
      for (const r of layoutData.renderers) {
        result = await r.call(renderCtx, result);
      }
    }

    return (
      <TDocsLayout props={result.layoutProps}>
        {renderPageMeta(page, props)}
        <TDocsPage props={result.pageProps}>
          <DocsTitle>{page.data.title}</DocsTitle>
          <DocsDescription className="mb-0">{page.data.description}</DocsDescription>
          <div className="flex flex-row gap-2 items-center border-b pt-2 pb-6">
            {result.markdownUrl && <MarkdownCopyButton markdownUrl={result.markdownUrl} />}
            <ViewOptionsPopover
              markdownUrl={result.markdownUrl}
              githubUrl={page.absolutePath ? getGitHubFileUrl(props, page.absolutePath) : undefined}
            />
          </div>
          <DocsBody>{result.body}</DocsBody>
          {result.lastModified && <PageLastUpdate date={result.lastModified} />}
        </TDocsPage>
      </TDocsLayout>
    );
  };
}
