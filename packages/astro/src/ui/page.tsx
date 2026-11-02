import type { AstroGlobal } from "astro";
import type { AstroComponentFactory } from "astro/runtime/server/index.js";
import { createElement, type ReactNode } from "react";
import { pageLinks, renderSlot, wrapSlot } from "@fumapress/core";
import type { HeadTag } from "fumadocs-core/framework/plugin";
import type * as PageTree from "fumadocs-core/page-tree";
import type { LoaderOutput, Page } from "fumadocs-core/source";
import { isCollectionPage, loadOnce } from "../content-source";
import { AstroSlot, islandProp, serializeIsland, type IslandData } from "../island/serialize";
import { getPressContext, getProviderData } from "../runtime";
import { ContentProvider, type ProviderData } from "./content";
import { Docs } from "./docs";
import { Home } from "./home";

type AstroProps = Pick<AstroGlobal, "url" | "params">;

const trees = new WeakMap<PageTree.Root, Promise<string>>();

/** JSON of the serialized page tree of a language, once per tree: island props are serialized again on each page */
function getSerializedTree(source: LoaderOutput, locale?: string): Promise<string> {
  const tree = source.getPageTree(locale);
  let json = trees.get(tree);
  if (!json) {
    json = source.serializePageTree(tree).then((serialized) => JSON.stringify(serialized));
    trees.set(tree, json);
  }
  return json;
}

/** the island of React content, in the provider of content */
export function getContentIsland(provider: ProviderData, node: ReactNode): Promise<IslandData> {
  return serializeIsland(createElement(ContentProvider, { provider, children: node }));
}

export interface HeadProps {
  /** the docs page */
  page?: Page;
  title?: string;
  description?: string;
  /** the path of your page without the base path, for its canonical URL */
  pathname?: string;
}

/** the head tags of every page, then of the docs page, or of your page */
export async function getHeadTags({
  page,
  title,
  description,
  pathname,
}: HeadProps): Promise<HeadTag[]> {
  const ctx = getPressContext();
  const tags = await ctx.getHead({});
  if (page) {
    const [pageHead, head] = await Promise.all([ctx.getPageHead(page), ctx.getHead({ page })]);
    tags.push(...pageHead, ...head);
    return tags;
  }

  if (title) tags.push({ tag: "title", children: title });
  if (description) tags.push({ tag: "meta", attrs: { name: "description", content: description } });
  if (pathname) tags.push(...pageLinks(ctx, pathname, []));
  return tags;
}

/** the islands of a docs page: the layout, and the body unless it is an Astro component */
export async function getDocsPage(
  astro: AstroProps,
  page: Page,
): Promise<
  { provider: ProviderData; layout: IslandData & { pageTree: string } } & (
    | { body: IslandData; Content?: undefined }
    | { body?: undefined; Content: AstroComponentFactory }
  )
> {
  const ctx = getPressContext();
  const provider = getProviderData(astro, page.locale);
  const [source, data, slots, layoutProps, body] = await Promise.all([
    ctx.getLoader(),
    ctx.getPageData(page),
    ctx.getSlots(page),
    ctx.defaultLayoutProps({ lang: page.locale }),
    ctx.getPageBody(page),
  ]);
  const island = await serializeIsland(
    createElement(Docs, {
      provider,
      // a prop of the island, rather than a string escaped again in its tree
      tree: islandProp<string>("pageTree"),
      page: data,
      layout: layoutProps,
      slots: {
        "page.actions": renderSlot(slots["page.actions"]),
        "page.footer": renderSlot(slots["page.footer"]),
      },
      children: wrapSlot(slots["body.wrapper"], createElement(AstroSlot)),
    }),
  );
  const layout = { ...island, pageTree: await getSerializedTree(source, page.locale) };

  if (body) return { provider, layout, body: await getContentIsland(provider, body.node) };
  if (isCollectionPage(page.data))
    return { provider, layout, Content: (await loadOnce(page.data)).body };
  throw new Error(
    `[Fumapress] no plugin renders the page "${page.path}", add the plugin of its content source.`,
  );
}

/** the island of `HomeLayout.astro`, `lang` is from the URL prefix by default */
export async function getHomeLayout(
  astro: AstroProps,
  { lang, notFound }: { lang?: string; notFound?: boolean },
): Promise<{ provider: ProviderData; island: IslandData; lang?: string }> {
  const ctx = getPressContext();
  const provider = getProviderData(astro, lang);
  const locale = provider.i18n?.locale ?? lang;
  const island = await serializeIsland(
    createElement(Home, {
      provider,
      layout: await ctx.defaultLayoutProps({ lang: locale }),
      notFound,
      children: createElement(AstroSlot),
    }),
  );
  return { provider, island, lang: locale };
}
