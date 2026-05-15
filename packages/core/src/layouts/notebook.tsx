import type { ConfigContext, Layouts } from "@/config";
import {
  AppContext,
  getGitHubFileUrl,
  renderPageMeta,
  TransformChildren,
  TransformChildrenSlot,
} from "@/lib/shared";
import type { Awaitable } from "@/lib/types";
import type { Page } from "fumadocs-core/source";
import { DocsLayout, type DocsLayoutProps } from "fumadocs-ui/layouts/notebook";
import {
  MarkdownCopyButton,
  ViewOptionsPopover,
  DocsPage,
  DocsTitle,
  DocsDescription,
  DocsBody,
  type DocsPageProps,
  PageLastUpdate,
} from "fumadocs-ui/layouts/notebook/page";
import type { ReactNode } from "react";
import { unstable_notFound } from "waku/router/server";

export interface NotebookLayoutOptions<C extends ConfigContext = ConfigContext> {
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

export interface NotebookLayoutRenderData {
  markdownUrl?: string;
  lastModified?: Date | null;
  body: ReactNode;
  layoutProps: TransformChildren<DocsLayoutProps>;
  pageProps: TransformChildren<DocsPageProps>;
}

export interface NotebookLayoutContextData {
  renderers?: ((
    this: { page: Page },
    data: NotebookLayoutRenderData,
  ) => Awaitable<NotebookLayoutRenderData>)[];
}

export function createNotebookLayout<C extends ConfigContext = ConfigContext>({
  render,
}: NotebookLayoutOptions<NoInfer<C>> = {}): Layouts<C>["page"] {
  async function renderToc(this: AppContext<C>, page: C["loaderConfig"]["page"]) {
    for (const adapter of this.adapters) {
      const toc = await adapter["core:render-toc"]?.call(this, page);
      if (toc !== undefined) return toc;
    }
  }

  async function renderBody(this: AppContext<C>, page: C["loaderConfig"]["page"]) {
    for (const adapter of this.adapters) {
      const body = await adapter["core:render-body"]?.call(this, page);
      if (body !== undefined) return body;
    }

    throw new Error("[Fumapress] Please specify the `render` option in createNotebookLayout()");
  }

  return async function Layout(props) {
    const {
      slugs,
      lang,
      getLoader,
      siteConfig,
      layouts,
      data: { "core:notebook-layout": layoutData },
    } = props;
    const source = await getLoader();
    const page = source.getPage(slugs, lang);
    if (!page) unstable_notFound();

    async function getLayoutProps(
      overrides?: TransformChildren<Partial<DocsLayoutProps>>,
    ): Promise<TransformChildren<DocsLayoutProps>> {
      const { name, git } = siteConfig;

      if (layouts.defaultProps) {
        overrides ??= await layouts.defaultProps.call(props, page!);
      }

      return {
        tree: source.getPageTree(lang),
        githubUrl: git ? `https://github.com/${git.user}/${git.repo}` : undefined,
        ...overrides,
        nav: {
          title: name,
          ...overrides?.nav,
        },
      };
    }

    const _raw = await render?.call(props, page);
    let result: NotebookLayoutRenderData = {
      ..._raw,
      pageProps: {
        ..._raw?.pageProps,
        toc: _raw?.pageProps?.toc ?? (await renderToc.call(props, page)),
      },
      body: _raw?.body ?? (await renderBody.call(props, page)),
      layoutProps: await getLayoutProps(_raw?.layoutProps),
    };

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
