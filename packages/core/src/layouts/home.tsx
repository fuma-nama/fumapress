import { type AppContext, type AppShape, getPressContext, mergeLayoutConfigs } from "@/app/context";
import { type Interceptor, renderWithInterceptors } from "@/lib/interceptors";
import type { Awaitable } from "@/lib/types";
import { HomeLayout, type HomeLayoutProps } from "fumadocs-ui/layouts/home";
import type { FC, ReactNode } from "react";

type LayoutComponent<C extends AppShape> = FC<{
  lang?: string | undefined;
  layoutProps?: HomeLayoutProps | undefined;
  children: ReactNode;
}> & { $ctx?: C };

export interface HomeLayoutPageOptions<C extends AppShape = AppShape> {
  /** swap the outer layout of page content */
  layout?: LayoutComponent<C>;

  render?: (
    this: AppContext<C>,
    page: C["page"],
  ) => Awaitable<{
    body?: ReactNode;
    layoutProps?: HomeLayoutProps;
  }>;
}

export function createHomeLayoutPage<C extends AppShape = AppShape>({
  layout: Container = createHomeLayout<C>(),
  render,
}: HomeLayoutPageOptions<NoInfer<C>> = {}) {
  return async function Layout({
    lang,
    page,
  }: {
    lang?: string;
    slugs: string[];
    page: C["page"];
  }) {
    const ctx = getPressContext<C>();
    const _raw = await render?.call(ctx, page);
    const body = _raw?.body ?? (await ctx.getPageBody(page))?.node;
    if (body == null) {
      throw new Error("[Fumapress] Please specify the `render` option in createHomeLayoutPage()");
    }

    return (
      <Container lang={lang} layoutProps={_raw?.layoutProps}>
        {ctx.renderPageMeta(page)}
        {body}
      </Container>
    );
  };
}

export interface HomeLayoutOptions<C extends AppShape = AppShape> {
  inherit?: {
    layoutProps?: boolean;
  };

  layoutProps?: HomeLayoutProps | ((this: AppContext<C>) => Awaitable<HomeLayoutProps>);
}

export interface HomeLayoutRenderData {
  body: ReactNode;
  layoutProps: HomeLayoutProps;
}

export type HomeInterceptor<S extends AppShape, T> = Interceptor<S, T>;

export interface HomeLayoutContextData<S extends AppShape = AppShape> {
  transformers?: ((opts: { data: HomeLayoutRenderData }) => Awaitable<HomeLayoutRenderData>)[];
  layoutInterceptors?: HomeInterceptor<S, HomeLayoutProps>[];
}

export function createHomeLayout<C extends AppShape = AppShape>({
  layoutProps: getLayoutProps,
  inherit: { layoutProps: inheritLayoutProps = true } = {},
}: HomeLayoutOptions<C> = {}): LayoutComponent<C> {
  return async function Layout({ layoutProps, children }) {
    const ctx = getPressContext<C>();
    const { layoutInterceptors, transformers } = ctx.data["core:home-layout"] ?? {};

    let result: HomeLayoutRenderData = {
      body: children,
      layoutProps: mergeLayoutConfigs(
        inheritLayoutProps ? await ctx.defaultLayoutProps() : undefined,
        typeof getLayoutProps === "function" ? await getLayoutProps.call(ctx) : getLayoutProps,
        layoutProps,
      ),
    };

    if (transformers) {
      for (const r of transformers) {
        result = await r({ data: result });
      }
    }

    const Layout = renderWithInterceptors(
      ctx,
      {},
      (props) => <HomeLayout {...props} />,
      layoutInterceptors,
    );

    return Layout({
      ...result.layoutProps,
      children: (
        <main
          data-fd-home-layout-container=""
          className="flex flex-col w-full max-w-[1400px] flex-1 px-4 py-6 mx-auto"
        >
          {result.body}
        </main>
      ),
    });
  };
}
