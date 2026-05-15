import type { ConfigContext, Layouts } from "@/config";
import {
  type AppContext,
  mergeLayoutConfigs,
  renderBody,
  renderPageMeta,
  renderToc,
  TransformChildren,
  TransformChildrenSlot,
} from "@/lib/shared";
import type { Awaitable } from "@/lib/types";
import type { Page } from "fumadocs-core/source";
import { TOCItemType } from "fumadocs-core/toc";
import { InlineTOC } from "fumadocs-ui/components/inline-toc";
import { HomeLayout, type HomeLayoutProps } from "fumadocs-ui/layouts/home";
import type { ReactNode } from "react";
import { unstable_notFound } from "waku/router/server";

export interface BlogLayoutOptions<C extends ConfigContext = ConfigContext> {
  render?: (
    this: AppContext<C>,
    page: C["loaderConfig"]["page"],
  ) => Awaitable<{
    toc?: TOCItemType[];
    body: ReactNode;
    layoutProps?: TransformChildren<HomeLayoutProps>;
  }>;
}

export interface BlogLayoutRenderData {
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
}: BlogLayoutOptions<NoInfer<C>>): Layouts<C>["page"] {
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

    return (
      <TransformChildrenSlot Comp={HomeLayout} props={result.layoutProps}>
        {renderPageMeta(page, props)}

        <h1 className="font-bold text-xl">{page.data.title}</h1>
        <p className="mt-4 text-fd-muted-foreground">{page.data.description}</p>
        {result.toc.length > 0 && <InlineTOC items={result.toc} />}
        <article className="prose">{result.body}</article>
      </TransformChildrenSlot>
    );
  };
}
