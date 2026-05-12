import type { ConfigContext } from "@/config";
import { type AppContext, baseOptions, renderPageMeta } from "@/lib/shared";
import type { Awaitable } from "@/lib/types";
import type { Layouts } from "@/router";
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
    layoutProps?: Partial<HomeLayoutProps>;
  }>;
}

export interface HomeLayoutRenderData {
  body: ReactNode;
  layoutProps: HomeLayoutProps;
}

export interface HomeLayoutContextData {
  renderers?: ((
    this: { page: Page },
    data: HomeLayoutRenderData,
  ) => Awaitable<HomeLayoutRenderData>)[];
}

export function createHomeLayout<C extends ConfigContext = ConfigContext>({
  render,
}: HomeLayoutOptions<C>): Layouts<C>["page"] {
  async function renderDefault(this: AppContext<C>, page: C["loaderConfig"]["page"]) {
    for (const adapter of this.adapters) {
      const body = await adapter["core:render-body"]?.call(this, page);
      if (body !== undefined) return { body } satisfies Partial<HomeLayoutRenderData>;
    }

    throw new Error("[Fumapress] Please specify the `render` option in createHomeLayout()");
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

    const _raw = await (render ?? renderDefault).call(props, page);
    let result: HomeLayoutRenderData = {
      body: _raw.body === undefined ? (await renderDefault.call(props, page)).body : _raw.body,
      layoutProps: _raw.layoutProps ?? baseOptions(props),
    };

    if (layoutData?.renderers) {
      const renderCtx = { page };
      for (const r of layoutData.renderers) {
        result = await r.call(renderCtx, result);
      }
    }

    return (
      <HomeLayout {...result.layoutProps}>
        {result.layoutProps.children}
        {renderPageMeta(page, props)}
        {result.body}
      </HomeLayout>
    );
  };
}
