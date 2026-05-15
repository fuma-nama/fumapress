import type { ConfigContext, Layouts } from "@/config";
import {
  type AppContext,
  renderPageMeta,
  TransformChildren,
  TransformChildrenSlot,
} from "@/lib/shared";
import type { Awaitable } from "@/lib/types";
import type { Page } from "fumadocs-core/source";
import { HomeLayout, type HomeLayoutProps } from "fumadocs-ui/layouts/home";
import type { ReactNode } from "react";
import { unstable_notFound } from "waku/router/server";

export interface HomeLayoutOptions<C extends ConfigContext = ConfigContext> {
  render?: (
    this: AppContext<C>,
    page: C["loaderConfig"]["page"],
  ) => Awaitable<{
    body?: ReactNode;
    layoutProps?: TransformChildren<HomeLayoutProps>;
  }>;
}

export interface HomeLayoutRenderData {
  body: ReactNode;
  layoutProps: TransformChildren<HomeLayoutProps>;
}

export interface HomeLayoutContextData {
  renderers?: ((
    this: { page: Page },
    data: HomeLayoutRenderData,
  ) => Awaitable<HomeLayoutRenderData>)[];
}

export function createHomeLayout<C extends ConfigContext = ConfigContext>({
  render,
}: HomeLayoutOptions<NoInfer<C>>): Layouts<C>["page"] {
  async function renderBody(this: AppContext<C>, page: C["loaderConfig"]["page"]) {
    for (const adapter of this.adapters) {
      const body = await adapter["core:render-body"]?.call(this, page);
      if (body !== undefined) return body;
    }

    throw new Error("[Fumapress] Please specify the `render` option in createHomeLayout()");
  }

  function getLayoutProps(
    this: AppContext<C>,
    overrides?: TransformChildren<HomeLayoutProps>,
  ): TransformChildren<HomeLayoutProps> {
    const { name, git } = this.siteConfig;

    return {
      githubUrl: git ? `https://github.com/${git.user}/${git.repo}` : undefined,
      ...overrides,
      nav: {
        title: name,
        ...overrides?.nav,
      },
    };
  }

  return async function Layout(props) {
    const {
      slugs,
      lang,
      getLoader,
      data: { "core:home-layout": layoutData },
    } = props;
    const source = await getLoader();
    const page = source.getPage(slugs, lang);
    if (!page) unstable_notFound();

    const _raw = await render?.call(props, page);
    let result: HomeLayoutRenderData = {
      body: _raw?.body ?? (await renderBody.call(props, page)),
      layoutProps: getLayoutProps.call(props, _raw?.layoutProps),
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
        {result.body}
      </TransformChildrenSlot>
    );
  };
}
