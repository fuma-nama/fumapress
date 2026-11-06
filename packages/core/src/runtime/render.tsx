import { createElement, Fragment, type ReactElement, type ReactNode } from "react";
import { i18nProvider } from "fumadocs-ui/i18n";
import type { Context, RuntimeContext } from "../context";
import type { AppShape, LangEnv, SlotItem } from "../plugin";
import type {
  DefaultPageProps,
  PageNode,
  PressConfig,
  ProviderProps,
  RenderTarget,
} from "../press";
import { DefaultDocs } from "../ui/docs";
import { HomeShell } from "../ui/home";

/** `children` inside the items of a wrapper slot, the first item outermost */
export function wrapSlot(items: SlotItem[] = [], children: ReactNode): ReactNode {
  return items.reduceRight<ReactNode>(
    (out, { component, props }) => createElement(component, props, out),
    children,
  );
}

/** the items of a named slot by name; `getSlots()` rejects two items of one name */
function namedItems(items: SlotItem[] = []): Partial<Record<string, ReactElement>> {
  const out: Partial<Record<string, ReactElement>> = {};
  for (const item of items) {
    if ("name" in item) out[item.name] = createElement(item.component, item.props);
  }
  return out;
}

/** the built-in UI: `DefaultDocs` for content pages, `HomeShell` around the content of plugins */
function renderDefault(ctx: Context, props: DefaultPageProps): PageNode {
  if (props.page && !props.children)
    return createElement(DefaultDocs, {
      layout: ctx.getCapability("ai-chat")?.DocsLayout,
      tree: props.tree,
      baseOptions: props.baseOptions,
      pageData: props.pageData,
      actions: createElement(Fragment, null, ...Object.values(props.actions)),
      footer: createElement(Fragment, null, ...Object.values(props.footer)),
      children: props.body,
    });
  return createElement(HomeShell, { baseOptions: props.baseOptions, children: props.children });
}

/** the page of `ui.renderPage`, or of the built-in UI without it */
export async function renderPage(
  ctx: RuntimeContext,
  ui: PressConfig<AppShape, any>["ui"],
  target: RenderTarget,
): Promise<PageNode> {
  const { lang } = target;
  const [loader, baseOptions] = await Promise.all([ctx.getLoader(), ctx.getBaseOptions({ lang })]);
  // each page has its own client state, like selected tabs: React would keep it for the next page at this position
  const base = {
    lang,
    tree: loader.getPageTree(lang),
    baseOptions,
    renderDefault: () => renderDefault(ctx, props),
  };
  let props: DefaultPageProps;

  if (target.view) {
    const { type, props: viewProps, node } = target.view;
    props = {
      ...viewProps,
      ...base,
      type,
      children: createElement(Fragment, { key: target.path }, node),
    };
  } else {
    const { page } = target;
    const [pageData, body, slots] = await Promise.all([
      ctx.getPageData(page),
      ctx.getPageBody(page),
      ctx.getSlots({ page }),
    ]);
    const node = wrapSlot(slots["body.wrapper"], body?.node);
    const view = await ctx.getPageView(page, body && { node });
    props = {
      ...view?.props,
      ...base,
      type: page.type,
      page,
      slugs: page.slugs,
      pageData,
      body: createElement(Fragment, { key: page.url }, node),
      actions: namedItems(slots.actions),
      footer: namedItems(slots.footer),
      children: view && createElement(Fragment, { key: page.url }, view.node),
    };
  }

  return ui?.renderPage ? ui.renderPage.call(ctx, props) : renderDefault(ctx, props);
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
