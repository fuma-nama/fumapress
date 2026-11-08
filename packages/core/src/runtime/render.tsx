import { createElement, Fragment, type ReactElement, type ReactNode } from "react";
import { i18nProvider } from "fumadocs-ui/i18n";
import { MarkdownCopyButton, ViewOptionsPopover } from "fumadocs-ui/layouts/docs/page";
import type { Context, RuntimeContext } from "../context";
import type { AppShape, LangEnv, PageData, SlotItem, SlotRegion } from "../plugin";
import type {
  DefaultPageProps,
  DefaultUIOptions,
  PageNode,
  PlacedSlot,
  PressConfig,
  ProviderProps,
  RenderTarget,
} from "../press";
import { DefaultDocs } from "../ui/docs";
import { HomeShell } from "../ui/home";

/** `children` inside the items of a wrapper slot, the first item outermost */
function wrapSlot(items: SlotItem[] = [], children: ReactNode): ReactNode {
  return items.reduceRight<ReactNode>(
    (out, { component, props }) => createElement(component, props, out),
    children,
  );
}

/** what the root renders around every page, inside its provider: the `banner` items above the page, in `layout-wrapper` */
export function wrapRoot(
  slots: Partial<Record<SlotRegion, SlotItem[]>>,
  page: ReactNode,
): ReactNode {
  const children: ReactNode[] = [];
  for (const { name, component, props } of slots.banner ?? [])
    children.push(createElement(component, { ...props, key: name }));
  children.push(createElement(Fragment, { key: "page" }, page));
  return wrapSlot(slots["layout-wrapper"], children);
}

/** the items of `regions` by name, in order, keyed by the page: each page has its own client state */
function placeSlots(
  out: Record<string, PlacedSlot>,
  slots: Partial<Record<SlotRegion, SlotItem[]>>,
  regions: readonly SlotRegion[],
  key: string,
) {
  for (const region of regions) {
    for (const { name, component, props } of slots[region] ?? [])
      out[name] = {
        region,
        element: createElement(component, { ...props, key: `${key} ${name}` }),
      };
  }
}

/** the elements of each region, in the order of `slots` */
function joinRegions(slots: DefaultPageProps["slots"]): Partial<Record<SlotRegion, ReactNode>> {
  const elements: Partial<Record<SlotRegion, ReactElement[]>> = {};
  for (const slot of Object.values(slots))
    if (slot) (elements[slot.region] ??= []).push(slot.element);
  const out: Partial<Record<SlotRegion, ReactNode>> = {};
  for (const [region, list] of Object.entries(elements))
    out[region as SlotRegion] = createElement(Fragment, null, ...list);
  return out;
}

/** the built-in UI: `DefaultDocs` for content pages, `HomeShell` around the content of plugins */
function renderDefault(props: DefaultPageProps, options: DefaultUIOptions = {}): PageNode {
  if (!props.page || props.children) {
    // the Home Layout has no page tree, which would reach the browser with it
    const { tree: _, ...layoutProps } = props.layoutProps;
    return createElement(HomeShell, { layoutProps, children: props.children });
  }

  const { layout, layoutProps, pageProps } = options;
  const regions = joinRegions(props.slots);
  return createElement(DefaultDocs, {
    layout,
    layoutProps: props.layoutProps,
    options: { layoutProps, pageProps },
    pageData: props.pageData,
    toc: props.toc,
    regions,
    children: props.body,
  });
}

/** the page of `ui.renderPage`, or of the built-in UI without it */
export async function renderPage(
  ctx: RuntimeContext,
  ui: PressConfig<AppShape, any>["ui"],
  target: RenderTarget,
  contentPageData: (
    page: AppShape["page"],
    loaded: Pick<PageData, "lastModified">,
  ) => Promise<PageData>,
): Promise<PageNode> {
  const { lang, page } = target;
  // each page has its own client state, like selected tabs: React would keep it for the next page at this position
  const key = page ? page.url : target.path;
  const env = page ? { lang, page } : { lang };
  const [loader, layoutProps, items] = await Promise.all([
    ctx.getLoader(),
    ctx.getLayoutProps(env),
    ctx.getSlots(env),
  ]);
  const slots: Record<string, PlacedSlot> = {};
  placeSlots(slots, items, ["sidebar-banner", "sidebar-footer"], key);
  const base = {
    lang,
    layoutProps: { ...layoutProps, tree: loader.getPageTree(lang) },
    slots,
    renderDefault: (options?: DefaultUIOptions) => renderDefault(props, options),
  };
  let props: DefaultPageProps;

  if (!page) {
    const { route, path, view } = target;
    props = {
      ...view.props,
      ...base,
      type: view.type,
      pageData: await ctx.getPageData(route, path),
      children: createElement(Fragment, { key }, view.node),
    };
  } else {
    const [pageData, toc = [], body] = await Promise.all([
      ctx.getPageLastModified(page).then((lastModified) => contentPageData(page, { lastModified })),
      ctx.getPageToc(page),
      ctx.getPageBody(page),
    ]);
    const { markdownUrl, githubUrl } = pageData;
    if (markdownUrl)
      slots["core:markdown"] = {
        region: "actions",
        element: createElement(MarkdownCopyButton, { key: `${key} core:markdown`, markdownUrl }),
      };
    slots["core:view-options"] = {
      region: "actions",
      element: createElement(ViewOptionsPopover, {
        key: `${key} core:view-options`,
        markdownUrl,
        githubUrl,
      }),
    };
    placeSlots(slots, items, ["actions", "footer", "toc-header", "toc-footer"], key);
    const node = wrapSlot(items["body-wrapper"], body?.node);
    const view = await ctx.getPageView(page, body && { node });
    props = {
      ...view?.props,
      ...base,
      type: page.type,
      page,
      slugs: page.slugs,
      pageData,
      toc,
      body: createElement(Fragment, { key }, node),
      children: view && createElement(Fragment, { key }, view.node),
    };
  }

  return ui?.renderPage ? ui.renderPage.call(ctx, props) : renderDefault(props);
}

/** the root provider's `i18n` from the site's translations in `lang` */
export function siteI18n(ctx: Context, { lang }: LangEnv<any>): ProviderProps["i18n"] {
  const translations = ctx.translationsConfig;
  if (!translations) return;
  return "config" in translations ? i18nProvider(translations, lang) : i18nProvider(translations);
}

/** `own` (`ui.providerProps.i18n`) over the site's translations; the URLs of the site decide where the language switch goes */
export function providerI18n(
  ctx: Context,
  env: LangEnv<any>,
  own: ProviderProps["i18n"],
): ProviderProps["i18n"] {
  const site = siteI18n(ctx, env);
  if (!site && !own) return;
  const merged = {
    ...site,
    ...own,
    translations: { ...site?.translations, ...own?.translations },
  };
  const i18n = ctx.i18nConfig;
  return i18n
    ? {
        locale: env.lang,
        ...merged,
        defaultLanguage: i18n.defaultLanguage,
        hideLocale: i18n.hideLocale,
      }
    : merged;
}
