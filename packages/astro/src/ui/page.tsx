import type { AstroGlobal } from "astro";
import { createElement, type ReactNode } from "react";
import type { PageAlternate, View } from "@fumapress/core";
import { mergeHead, pageLinks, pathLocale, renderPage, wrapSlot } from "@fumapress/core/runtime";
import { mergeI18n } from "@fumapress/core/runtime/ui";
import type { HeadTag } from "@fumapress/core";
import type { Page } from "fumadocs-core/source";
import { AstroSlot, serializeIsland, type IslandData } from "../island/serialize";
import type { ViewPage } from "../routes/shared";
import config from "virtual:fumapress/config";
import { getPressContext, getProviderData } from "../runtime";
import { ContentProvider, type ProviderData } from "./content";
import { renderDefault } from "./default";
import { Home } from "./home";
import { Provider } from "./provider";

type AstroProps = Pick<AstroGlobal, "url" | "params">;

/** the props of `Island.astro` */
type IslandProps = IslandData & { provider: ProviderData };

/** what `Page.astro` renders: a content page, or a view with the result of its `view()` */
export type PageTarget = { page: Page } | { view: ViewPage; content: View<any> };

/** a page in `Layout.astro`: its language, head tags and island */
export interface RenderedPage {
  lang?: string;
  head: HeadTag[];
  island: IslandProps;
}

/** the island of a page, in the root provider with `layout.wrapper` around it */
async function getIsland(
  provider: ProviderData,
  lang: string | undefined,
  node: ReactNode,
): Promise<IslandProps> {
  const ctx = getPressContext();
  // `withBase()` gives the URLs of routes rendered on request, like the actions of slots, once the routes are collected
  await ctx.getRoutes();
  const [slots, { i18n, ...props }] = await Promise.all([
    ctx.getSlots({}),
    ctx.getProviderProps({ lang }),
  ]);
  provider = { ...provider, i18n: mergeI18n(provider.i18n, i18n) };
  const island = await serializeIsland(
    createElement(Provider, {
      provider,
      props,
      children: wrapSlot(slots["layout.wrapper"], node),
    }),
  );
  return { ...island, provider };
}

/** the island of React content, in the provider of content */
export async function getContentIsland(
  provider: ProviderData,
  node: ReactNode,
): Promise<IslandProps> {
  const island = await serializeIsland(
    createElement(ContentProvider, { provider, children: node }),
  );
  return { ...island, provider };
}

/** a content page or a view, rendered by `ui.renderPage` */
export async function getPage(astro: AstroProps, target: PageTarget): Promise<RenderedPage> {
  const ctx = getPressContext();
  const lang = "page" in target ? target.page.locale : target.view.route.lang;
  const [node, head] = await Promise.all([
    renderPage(
      ctx,
      config,
      "page" in target ? { lang, page: target.page } : { lang, view: target.content },
      renderDefault,
    ),
    ctx.getHead(
      "page" in target
        ? { page: target.page }
        : { route: target.view.route, path: target.view.page.path, view: target.content },
    ),
  ]);
  return { lang, head, island: await getIsland(getProviderData(astro, lang), lang, node) };
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

/** your own page in the home layout, its content is the default slot of the island */
export async function getHomeLayout(
  astro: AstroProps,
  { title, description, lang, alternates = [], notFound }: HomeLayoutOptions,
): Promise<RenderedPage> {
  const ctx = getPressContext();
  const provider = getProviderData(astro, lang);
  const locale = lang ?? pathLocale(ctx, provider.pathname);
  const [baseOptions, head] = await Promise.all([
    ctx.getBaseOptions({ lang: locale }),
    ctx.getHead({}),
  ]);
  const island = await getIsland(
    provider,
    locale,
    createElement(Home, { baseOptions, notFound, children: createElement(AstroSlot) }),
  );
  const own: HeadTag[] = [];
  if (title) own.push({ tag: "title", children: title });
  if (description) own.push({ tag: "meta", attrs: { name: "description", content: description } });
  const tags = mergeHead([own, head]);
  if (!notFound) tags.push(...pageLinks(ctx, provider.pathname, alternates));
  return { lang: locale, head: tags, island };
}
