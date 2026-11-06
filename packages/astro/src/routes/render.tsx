import type { AstroGlobal } from "astro";
import { createElement, isValidElement, type ReactNode } from "react";
import type { AstroComponentFactory } from "astro/runtime/server/index.js";
import type { PageAlternate, PageRoute } from "@fumapress/core";
import {
  matchPageRoute,
  mergeHead,
  pageLinks,
  pathLocale,
  wrapSlot,
  type RenderTarget,
} from "@fumapress/core/runtime";
import type { HeadTag } from "@fumapress/core";
import {
  AstroContent,
  isAstroComponent,
  serializeIsland,
  type IslandData,
} from "../island/serialize";
import { ctx } from "./context";
import type { PageProps } from "./shared";
import { getProviderData } from "../runtime";
import { ContentProvider, type ProviderData } from "../ui/content";
import { Home } from "../ui/home";
import { LayoutRoot, layoutRootKeys } from "../ui/layout-root";
import { Provider } from "../ui/provider";

type AstroProps = Pick<AstroGlobal, "url" | "params">;

/** the props of `Island.astro` */
type PageIsland = IslandData & { provider: ProviderData };

/** a page in `Layout.astro`: its language, head tags and island */
export interface RenderedPage {
  lang?: string;
  head: HeadTag[];
  island: PageIsland;
  /** the `.astro` file from `ui.renderPage`, it renders instead of the island */
  layout?: {
    component: AstroComponentFactory;
    props: object;
    /** the island of the page content, its default slot */
    content: PageIsland;
  };
}

/** the props of the element `ui.renderPage` returns, by what the server keeps from the React root */
interface LayoutElementProps extends Record<string, unknown> {
  body?: ReactNode;
  children?: ReactNode;
}

/** the island of the React root of an `.astro` layout: without the props that only the server has, and the content in its slot */
async function renderLayout(
  provider: ProviderData,
  lang: string | undefined,
  component: AstroComponentFactory,
  props: LayoutElementProps,
): Promise<{ island: PageIsland; layout: NonNullable<RenderedPage["layout"]> }> {
  const { body, children, renderDefault: _, ...layoutProps } = props;
  const root: Record<string, unknown> = {};
  for (const key of layoutRootKeys) root[key] = props[key];
  const island = await getIsland(provider, lang, createElement(LayoutRoot, root), true);
  return {
    island,
    layout: {
      component,
      props: { ...layoutProps, island: island.tree },
      content: await getContentIsland(island.provider, children ?? body),
    },
  };
}

/** the island of a page, in the root provider with `layout.wrapper` around it */
async function getIsland(
  provider: ProviderData,
  lang: string | undefined,
  node: ReactNode,
  inline?: boolean,
): Promise<PageIsland> {
  const [slots, { i18n, ...props }] = await Promise.all([
    ctx.getSlots({}),
    ctx.getProviderProps({ lang }),
  ]);
  provider = { ...provider, i18n };
  const island = await serializeIsland(
    createElement(Provider, {
      provider,
      props,
      children: wrapSlot(slots["layout.wrapper"], node),
    }),
    inline,
  );
  return { ...island, provider };
}

/** the island of React content, in the provider of content */
async function getContentIsland(provider: ProviderData, node: ReactNode): Promise<PageIsland> {
  const island = await serializeIsland(
    createElement(ContentProvider, { provider, children: node }),
  );
  return { ...island, provider };
}

async function renderTarget(
  astro: AstroProps,
  target: RenderTarget,
  headTags: Promise<HeadTag[]>,
): Promise<RenderedPage> {
  const [node, head] = await Promise.all([ctx.renderPage(target), headTags]);
  const { lang } = target;
  const provider = getProviderData(astro, lang);
  if (isValidElement<LayoutElementProps>(node) && isAstroComponent(node.type))
    return { lang, head, ...(await renderLayout(provider, lang, node.type, node.props)) };
  return { lang, head, island: await getIsland(provider, lang, node) };
}

/** a content page or a view rendered by `ui.renderPage`, or the response of a redirect, or a 404 for a view without content */
export async function getPage(
  astro: AstroProps & Pick<AstroGlobal, "request">,
  { page, view, redirect }: PageProps,
): Promise<RenderedPage | Response> {
  if (redirect !== undefined)
    return new Response(null, { status: 302, headers: { Location: redirect } });
  if (page) return renderTarget(astro, { lang: page.locale, page }, ctx.getHead({ page }));

  if (view) {
    const { params, path } = view.page;
    const { view: route, lang } = view.route;
    const content =
      route?.render === "dynamic"
        ? await route.view(params, { lang, request: astro.request })
        : await route?.view(params, { lang });
    if (content)
      return renderTarget(
        astro,
        { lang, view: content, path },
        ctx.getHead({ route: view.route, path, view: content }),
      );
  }
  return new Response(null, { status: 404 });
}

export interface HomeLayoutOptions {
  title?: string;
  description?: string;
  /** the language of the page, from its URL prefix by default */
  lang?: string;
  /** the translations of the page, for `hreflang` links */
  alternates?: PageAlternate[];
  /** render the not found page of Fumadocs UI */
  notFound?: boolean;
}

/** a custom page in the home layout, its content is the default slot of the island */
export async function getHomeLayout(
  astro: AstroProps,
  { title, description, lang, alternates, notFound }: HomeLayoutOptions,
): Promise<RenderedPage> {
  const provider = getProviderData(astro, lang);
  const path = provider.pathname;
  const locale = lang ?? pathLocale(ctx, path);
  const matched = matchPageRoute(await ctx.getPageRoutes(), path)?.route;
  // `hreflang` links only come from `alternates`
  const route: PageRoute = {
    path,
    lang: locale,
    render: "static",
    options: {},
    ...matched,
    pages: [],
  };
  const [baseOptions, head] = await Promise.all([
    ctx.getBaseOptions({ lang: locale }),
    ctx.getHead(notFound ? {} : { route, path }),
  ]);
  const island = await getIsland(
    provider,
    locale,
    createElement(Home, { baseOptions, notFound, children: createElement(AstroContent) }),
  );
  const own: HeadTag[] = [];
  if (title) own.push({ tag: "title", children: title });
  if (description) own.push({ tag: "meta", attrs: { name: "description", content: description } });
  const links = alternates && !notFound ? pageLinks(ctx, path, alternates) : undefined;
  return { lang: locale, head: mergeHead([own, head, links]), island };
}
