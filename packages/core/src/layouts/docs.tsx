import type { ConfigContext, Layouts } from "@/config";
import {
  AppContext,
  baseOptions,
  getGitHubFileUrl,
  renderPageMeta,
  TransformChildren,
  TransformChildrenSlot,
} from "@/lib/shared";
import type { Awaitable } from "@/lib/types";
import type { Page } from "fumadocs-core/source";
import { TOCItemType } from "fumadocs-core/toc";
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
    layoutProps?: TransformChildren<Partial<DocsLayoutProps>>;
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
  async function defaultRender(this: AppContext<C>, page: C["loaderConfig"]["page"]) {
    let body: ReactNode | undefined;
    let toc: TOCItemType[] | undefined;

    for (const adapter of this.adapters) {
      body = await adapter["core:render-body"]?.call(this, page);
      if (body !== undefined) break;
    }

    for (const adapter of this.adapters) {
      toc = await adapter["core:render-toc"]?.call(this, page);
      if (toc !== undefined) break;
    }

    if (body === undefined)
      throw new Error("[Fumapress] Please specify the `render` option in createDocsLayout()");

    return {
      body,
      pageProps: { toc },
    } satisfies Partial<DocsLayoutRenderData>;
  }

  return async function Layout(props) {
    const {
      slugs,
      lang,
      getLoader,
      data: { "core:docs-layout": layoutData },
    } = props;
    const source = await getLoader();
    const page = source.getPage(slugs, lang);
    if (!page) unstable_notFound();

    const _raw = await (render ?? defaultRender).call(props, page);
    let result: DocsLayoutRenderData;

    if (_raw.body === undefined || _raw.pageProps === undefined) {
      const _default = await defaultRender.call(props, page);
      result = {
        markdownUrl: _raw.markdownUrl,
        pageProps: _raw.pageProps ?? _default.pageProps,
        body: _raw.body ?? _default.body,
        layoutProps: {
          tree: source.getPageTree(lang),
          ...(_raw.layoutProps ?? baseOptions(props)),
        },
      };
    } else {
      result = {
        body: _raw.body,
        pageProps: _raw.pageProps,
        markdownUrl: _raw.markdownUrl,
        layoutProps: {
          tree: source.getPageTree(lang),
          ...(_raw.layoutProps ?? baseOptions(props)),
        },
      };
    }

    if (layoutData?.renderers) {
      const renderCtx = { page };
      for (const r of layoutData.renderers) {
        result = await r.call(renderCtx, result);
      }
    }

    return (
      <TransformChildrenSlot Comp={DocsLayout} props={result.layoutProps}>
        {renderPageMeta(page, props)}
        <TransformChildrenSlot Comp={DocsPage} props={result.pageProps}>
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
        </TransformChildrenSlot>
      </TransformChildrenSlot>
    );
  };
}
