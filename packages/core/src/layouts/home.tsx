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
import { HomeLayout, type HomeLayoutProps } from "fumadocs-ui/layouts/home";
import type { ComponentType, FC, ReactNode } from "react";

export interface HomeLayoutPageOptions<C extends ConfigContext = ConfigContext> {
  /** swap the outer layout of page content */
  layout?: ComponentType<ContainerProps<C>>;

  render?: (
    this: AppContext<C>,
    page: C["loaderConfig"]["page"],
  ) => Awaitable<{
    body?: ReactNode;
    layoutProps?: TransformChildren<HomeLayoutProps>;
  }>;
}

export function createHomeLayoutPage<C extends ConfigContext = ConfigContext>({
  layout: Container = createHomeLayout<C>(),
  render,
}: HomeLayoutPageOptions<NoInfer<C>> = {}): Layouts<C>["page"] {
  return async function Layout({ lang, page, ctx }) {
    const _raw = await render?.call(ctx, page);
    const body =
      _raw?.body ??
      (await renderBody(
        ctx,
        page,
        "[Fumapress] Please specify the `render` option in createHomeLayoutPage()",
      ));

    return (
      <Container lang={lang} layoutProps={_raw?.layoutProps} ctx={ctx}>
        {renderPageMeta(page, ctx)}
        {body}
      </Container>
    );
  };
}

export interface HomeLayoutOptions<C extends ConfigContext = ConfigContext> {
  inherit?: {
    layoutProps?: boolean;
  };

  layoutProps?:
    | TransformChildren<HomeLayoutProps>
    | ((this: AppContext<C>) => Awaitable<TransformChildren<HomeLayoutProps>>);
}

export interface HomeLayoutRenderData {
  body: ReactNode;
  layoutProps: TransformChildren<HomeLayoutProps>;
}

export interface HomeLayoutContextData {
  renderers?: ((data: HomeLayoutRenderData) => Awaitable<HomeLayoutRenderData>)[];
}

interface ContainerProps<C extends ConfigContext> {
  lang?: string;
  layoutProps?: TransformChildren<HomeLayoutProps>;
  children: ReactNode;
  ctx: AppContext<C>;
}

export function createHomeLayout<C extends ConfigContext = ConfigContext>({
  layoutProps: getLayoutProps,
  inherit: { layoutProps: inheritLayoutProps = true } = {},
}: HomeLayoutOptions<C> = {}): FC<ContainerProps<C>> {
  const THomeLayout = createTransformChildren(HomeLayout);

  return async function Layout({ lang, layoutProps, children, ctx }) {
    const {
      layouts,
      data: { "core:home-layout": layoutData },
    } = ctx;

    const inherited = inheritLayoutProps
      ? await layouts.defaultProps?.call(ctx, { lang })
      : undefined;
    let result: HomeLayoutRenderData = {
      body: children,
      layoutProps: mergeLayoutConfigs(
        baseLayoutProps(ctx),
        inherited,
        typeof getLayoutProps === "function" ? await getLayoutProps.call(ctx) : getLayoutProps,
        layoutProps,
      ),
    };

    if (layoutData?.renderers) {
      for (const r of layoutData.renderers) {
        result = await r(result);
      }
    }

    return (
      <THomeLayout props={result.layoutProps}>
        <main
          data-fd-home-layout-container=""
          className="flex flex-col w-full max-w-[1400px] flex-1 px-4 py-6 mx-auto"
        >
          {result.body}
        </main>
      </THomeLayout>
    );
  };
}
