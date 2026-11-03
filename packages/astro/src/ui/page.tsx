import type { AstroGlobal } from "astro";
import type { AstroComponentFactory } from "astro/runtime/server/index.js";
import { createElement, type ReactNode } from "react";
import { pageLinks, renderSlot, wrapSlot, type Context, type PageAlternate } from "@fumapress/core";
import type { HeadTag } from "fumadocs-core/framework/plugin";
import type { Page } from "fumadocs-core/source";
import { getPageTreeFile, isCollectionPage, loadOnce } from "../content-source";
import { AstroSlot, islandProp, serializeIsland, type IslandData } from "../island/serialize";
import { getPressContext, getProviderData } from "../runtime";
import { ContentProvider, type ProviderData } from "./content";
import { Docs, serverTrees } from "./docs";
import { Home } from "./home";
import { Provider } from "./provider";

type AstroProps = Pick<AstroGlobal, "url" | "params">;

/** the URL of the page tree of a language, its serialized tree is registered for the docs island on the server */
async function getTreeUrl(ctx: Context, locale?: string): Promise<string> {
  const file = await getPageTreeFile(await ctx.getLoader(), locale);
  const url = ctx.withBase(file.path);
  serverTrees.set(url, file.serialized);
  return url;
}

/** the island of React content, in the provider of content */
export function getContentIsland(provider: ProviderData, node: ReactNode): Promise<IslandData> {
  return serializeIsland(createElement(ContentProvider, { provider, children: node }));
}

/** the island of a layout, in the root provider with `layout.wrapper` around it */
async function getLayoutIsland(provider: ProviderData, layout: ReactNode): Promise<IslandData> {
  const slots = await getPressContext().getSlots({});
  return serializeIsland(
    createElement(Provider, { provider, children: wrapSlot(slots["layout.wrapper"], layout) }),
  );
}

export interface HeadProps {
  /** the docs page */
  page?: Page;
  title?: string;
  description?: string;
  /** the path of your page without the base path, for its canonical URL */
  pathname?: string;
  /** the translations of your page, for `hreflang` links */
  alternates?: PageAlternate[];
}

/** the head tags of every page, then of the docs page, or of your page */
export async function getHeadTags({
  page,
  title,
  description,
  pathname,
  alternates = [],
}: HeadProps): Promise<HeadTag[]> {
  const ctx = getPressContext();
  const tags = await ctx.getHead({});
  if (page) {
    const [pageHead, head, tree] = await Promise.all([
      ctx.getPageHead(page),
      ctx.getHead({ page }),
      getTreeUrl(ctx, page.locale),
    ]);
    tags.push(...pageHead, ...head, {
      tag: "link",
      // the docs island fetches it, in parallel with its scripts; kept on navigation like `transition:persist`, the island fetches the trees of other languages itself
      attrs: {
        rel: "preload",
        as: "fetch",
        crossorigin: "",
        href: tree,
        "data-astro-transition-persist": "fumapress-page-tree",
      },
    });
    return tags;
  }

  if (title) tags.push({ tag: "title", children: title });
  if (description) tags.push({ tag: "meta", attrs: { name: "description", content: description } });
  if (pathname) tags.push(...pageLinks(ctx, pathname, alternates));
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
  const [pageTree, data, slots, layoutProps, body] = await Promise.all([
    getTreeUrl(ctx, page.locale),
    ctx.getPageData(page),
    ctx.getSlots({ page }),
    ctx.defaultLayoutProps({ lang: page.locale }),
    ctx.getPageBody(page),
  ]);
  const island = await getLayoutIsland(
    provider,
    createElement(Docs, {
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
  const layout = { ...island, pageTree };

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
  const island = await getLayoutIsland(
    provider,
    createElement(Home, {
      layout: await ctx.defaultLayoutProps({ lang: locale }),
      notFound,
      children: createElement(AstroSlot),
    }),
  );
  return { provider, island, lang: locale };
}
