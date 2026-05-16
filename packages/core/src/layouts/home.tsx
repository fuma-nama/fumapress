import type { ConfigContext, Layouts } from "@/config";
import {
  type AppContext,
  baseLayoutProps,
  createTransformChildren,
  mergeLayoutConfigs,
  renderBody,
  renderPageMeta,
  TransformChildren,
} from "@/lib/shared";
import type { Awaitable } from "@/lib/types";
import type { Page } from "fumadocs-core/source";
import { HomeLayout, type HomeLayoutProps } from "fumadocs-ui/layouts/home";
import type { ComponentType, ReactNode } from "react";
import { unstable_notFound } from "waku/router/server";

export interface HomeLayoutPageOptions<C extends ConfigContext = ConfigContext> {
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
    this: { page: Page | undefined },
    data: HomeLayoutRenderData,
  ) => Awaitable<HomeLayoutRenderData>)[];
}

export function createHomeLayoutPage<C extends ConfigContext = ConfigContext>({
  render,
}: HomeLayoutPageOptions<NoInfer<C>> = {}): Layouts<C>["page"] {
  const THomeLayout = createTransformChildren(HomeLayout);

  return async function Layout({ slugs, lang, ctx }) {
    const {
      getLoader,
      layouts,
      data: { "core:home-layout": layoutData },
    } = ctx;
    const source = await getLoader();
    const page = source.getPage(slugs, lang);
    if (!page) unstable_notFound();

    async function getLayoutProps(
      overrides?: TransformChildren<HomeLayoutProps>,
    ): Promise<TransformChildren<HomeLayoutProps>> {
      const inherit = await layouts.defaultProps?.call(ctx, { lang });

      return mergeLayoutConfigs(baseLayoutProps(ctx), inherit, overrides);
    }

    const _raw = await render?.call(ctx, page);
    let result: HomeLayoutRenderData = {
      body:
        _raw?.body ??
        (await renderBody(
          ctx,
          page,
          "[Fumapress] Please specify the `render` option in createHomeLayoutPage()",
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
      <THomeLayout props={result.layoutProps}>
        {renderPageMeta(page, ctx)}
        {result.body}
      </THomeLayout>
    );
  };
}

export interface HomeLayoutOptions<C extends ConfigContext = ConfigContext> {
  render?: (this: AppContext<C>) => Awaitable<{
    layoutProps?: TransformChildren<HomeLayoutProps>;
  }>;
}

export function createHomeLayout<C extends ConfigContext = ConfigContext>({
  render,
}: HomeLayoutOptions<C> = {}): ComponentType<{
  lang?: string;
  children: ReactNode;
  ctx: AppContext<C>;
}> {
  const THomeLayout = createTransformChildren(HomeLayout);

  return async function Layout({ lang, children, ctx }) {
    const {
      layouts,
      data: { "core:home-layout": layoutData },
    } = ctx;

    async function getLayoutProps(
      overrides?: TransformChildren<HomeLayoutProps>,
    ): Promise<TransformChildren<HomeLayoutProps>> {
      const inherit = await layouts.defaultProps?.call(ctx, { lang });

      return mergeLayoutConfigs(baseLayoutProps(ctx), inherit, overrides);
    }

    const _raw = await render?.call(ctx);
    let result: HomeLayoutRenderData = {
      body: children,
      layoutProps: await getLayoutProps(_raw?.layoutProps),
    };

    if (layoutData?.renderers) {
      const renderCtx = { page: undefined };
      for (const r of layoutData.renderers) {
        result = await r.call(renderCtx, result);
      }
    }

    return <THomeLayout props={result.layoutProps}>{result.body}</THomeLayout>;
  };
}
