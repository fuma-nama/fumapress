import {
  computed,
  defineComponent,
  h,
  inject,
  mergeProps,
  shallowRef,
  type Component,
  type InjectionKey,
  type Ref,
  type ShallowRef,
} from "vue";
import type { Router } from "./router";
import { pageTitle } from "./core/head";
import { localeOf } from "./core/i18n";
import type { ContentPage, PageOf, Press, PressPageType, ViewPage } from "./core/press";
import {
  encodePath,
  normalizePath,
  safeHref,
  pageDataPath,
  searchIndexPath,
  siteDataPath,
} from "./core/routes";
import type { LayoutProps } from "./core/layouts";
import type { Theme } from "./core/theme";
import type {
  Load,
  PageBody,
  PageContent,
  PageData,
  PageModule,
  PageTree,
  SiteConfig,
  SiteData,
} from "./core/types";

export { pageTitle, safeHref, searchIndexPath };
export { mergeOptions } from "./core/merge";

declare module "vue" {
  interface ComponentCustomOptions {
    /**
     * The data of a custom page, a `.vue` file of `src/pages`: its title and description, which the head tags of
     * the site are made from like those of a content page. `defineOptions({ page: { title: "About" } })`
     */
    page?: PageData;
  }
}
export {
  createRouter,
  type AfterEachHook,
  type BeforeEachHook,
  type Route,
  type RouteRecord,
  type Router,
  type RouterOptions,
} from "./router";
export { searchIndex, type SearchEntry, type SearchResult } from "./core/search";
export type {
  HeadTag,
  Jsonify,
  Load,
  PageData,
  PageTree,
  SiteData,
  SiteI18n,
  TOCItem,
} from "./core/types";
export type { LayoutProps, LayoutTab, LinkItem, NavOptions } from "./core/layouts";
export type {
  ContentPage,
  ContentPageOf,
  PageOf,
  PressContext,
  PressLang,
  PressPageType,
  ViewPage,
  ViewPageOf,
} from "./core/press";
export type { Theme, ThemeOptions, ThemeViews, ViewComponent } from "./core/theme";

/**
 * A page of any site as the browser receives it: a content page, a content page a plugin renders as a view (with
 * its `props` in place of `Content`), or a view.
 */
export type LoadedPage =
  | ContentPage
  | (Omit<ContentPage, "Content"> & { props: object })
  | ViewPage;

/** a page ready to render: the component of `views` for its type receives it as `page` */
export interface ShownPage {
  page: LoadedPage;
  component: Component;
  /** the title and description of its `<head>`, which the browser applies when it navigates to the page */
  head: PageContent["head"];
}

/** a theme with the themes it extends merged into it */
export type ResolvedTheme = Omit<Theme, "extends" | "views" | "components" | "icons" | "head"> &
  Required<Pick<Theme, "views" | "components" | "icons" | "head">>;

/**
 * Merges a theme with the themes it extends: maps merge with the entries of the theme winning, lists are joined,
 * every `enhanceApp` runs, and the theme's `Root` and `NotFound` replace theirs. A later theme of a list wins.
 */
export function resolveTheme(theme: Theme): ResolvedTheme {
  const themes = [...[theme.extends ?? []].flat().map(resolveTheme), theme];
  const last = <K extends "Root" | "NotFound">(key: K) =>
    themes.findLast((each) => each[key])?.[key];
  const map = <K extends "views" | "components" | "icons">(key: K): ResolvedTheme[K] =>
    Object.assign({}, ...themes.map((each) => each[key]));
  const hooks = themes.flatMap((each) => each.enhanceApp ?? []);

  return {
    Root: last("Root"),
    NotFound: last("NotFound"),
    views: map("views"),
    components: map("components"),
    icons: map("icons"),
    head: themes.flatMap((each) => each.head ?? []),
    enhanceApp: hooks.length > 0 ? (ctx) => hooks.forEach((hook) => hook(ctx)) : undefined,
  };
}

export interface PressState {
  /** the language of the document: another language is another document */
  lang: string;
  /** the data every page of the language needs: the site's info, the layout props and the page tree */
  site: SiteData;
  theme: ResolvedTheme;
  /** the page on screen, none on custom pages and URLs without a page */
  shown: ShallowRef<ShownPage | undefined>;
  /** the value of a data route of the server, by its path */
  load: Load;
}

export const pressKey: InjectionKey<PressState> = Symbol.for("fumapress");

/**
 * `load` in the browser: `loaded` are the values the server sent with the page, by path, for the data routes the app
 * read to render it. Another path is one request.
 */
export function createLoad(base: string, loaded: Record<string, unknown>): Load {
  const cache = new Map<string, Promise<unknown>>(
    Object.entries(loaded).map(([path, value]) => [path, Promise.resolve(value)]),
  );

  return ((path: string) => {
    let value = cache.get(path);
    if (!value) {
      // a path without a value is a 404, which is kept; a request that failed is made again the next time
      const retry = () => void cache.delete(path);
      value = fetch(base + encodePath(path).slice(1)).then(
        (response) => {
          if (response.ok) return response.json();
          if (response.status !== 404) retry();
        },
        () => retry(),
      );
      cache.set(path, value);
    }
    return value;
  }) as Load;
}

/** the names of icons in a page tree as the components of the theme */
function withIcons(root: PageTree.Root, icons: Record<string, Component>): PageTree.Root {
  const node = <T extends PageTree.Node>(item: T): T => {
    const out = { ...item };
    if (typeof out.icon === "string" && Object.hasOwn(icons, out.icon)) out.icon = icons[out.icon];
    if (out.type === "folder") {
      out.children = out.children.map(node);
      if (out.index) out.index = node(out.index);
    }
    return out;
  };

  return {
    ...root,
    children: root.children.map(node),
    fallback: root.fallback && withIcons(root.fallback, icons),
  };
}

/**
 * The state of an app in a language: `load` reads the data routes of the server, without a request when on it. The
 * language is the one of the document, `<html lang>` in the browser.
 */
export async function createPressState(
  lang: string,
  load: Load,
  theme: Theme,
): Promise<PressState> {
  const site = await load<SiteData>(siteDataPath(lang));
  if (!site) throw new Error("[Fumapress] The data of the site failed to load.");
  const resolved = resolveTheme(theme);

  return {
    lang,
    site: { ...site, tree: withIcons(site.tree, resolved.icons) },
    theme: resolved,
    shown: shallowRef(),
    load,
  };
}

function contentOf(state: PressState, url: string): Promise<PageContent | undefined> {
  return state.load<PageContent>(pageDataPath(url));
}

/** the content of a page as a component: the server has the module, the browser imports it by its URL */
async function contentComponent(body: Exclude<PageBody, { view: unknown }>): Promise<Component> {
  if ("html" in body) return () => h("div", { innerHTML: body.html });
  const mod: PageModule = await (body.load?.() ?? import(/* @vite-ignore */ body.module));
  return mod.default as Component;
}

/** a component, not a function importing one: a functional component declares its props, as in Vue Router */
function isComponent(value: object): value is Component {
  return typeof value === "object" || "props" in value || "displayName" in value;
}

/** the component of `views` for a page type, imported when it is a function: content types fall back to `default` */
async function viewOf(state: PressState, type: string | undefined, content: boolean) {
  const { views } = state.theme;
  const own = type !== undefined && Object.hasOwn(views, type) ? views[type] : undefined;
  const view = own ?? (content ? views.default : undefined);
  if (!view) {
    const key = content ? "default" : type;
    throw new Error(
      `[Fumapress] The theme has no \`views["${key}"]\` for the pages of ${type ?? "the content"}.`,
    );
  }
  if (isComponent(view)) return view;
  const loaded = await (view as () => Promise<Component | { default: Component }>)();
  return "default" in loaded ? loaded.default : loaded;
}

/** a page with the component that renders it, and its content when it has one */
async function showPage(state: PressState, url: string, content: PageContent): Promise<ShownPage> {
  const { pageData, head } = content;
  if (!("body" in content)) {
    const { type, props } = content;
    return {
      page: { type, url, props, pageData },
      component: await viewOf(state, type, false),
      head,
    };
  }

  const { type, data, toc, body } = content;
  // a plugin renders the pages of its source as views: their component receives the props, not a content
  if ("view" in body) {
    const page = { type, url, data, pageData, toc, props: body.view.props };
    return { page, component: await viewOf(state, type, false), head };
  }
  const [component, Content] = await Promise.all([
    viewOf(state, type, true),
    contentComponent(body),
  ]);
  return { page: { type, url, data, pageData, toc, Content }, component, head };
}

/** the page of a URL, ready to render: a content page or a view, none when the URL has neither */
export async function loadPage(
  state: PressState,
  pathname: string,
): Promise<ShownPage | undefined> {
  const url = normalizePath(pathname);
  const content = await contentOf(state, url);
  return content && showPage(state, url, content);
}

/** loads a page ahead of a navigation, like when a link to it is hovered: its content and its component */
export function prefetchPage(state: PressState, pathname: string): void {
  // a failed request is made again by the navigation, which reports it
  const url = normalizePath(pathname);
  contentOf(state, url)
    .then((content) => content && showPage(state, url, content))
    .catch(() => {});
}

/** the language of a URL of the site: the one of the document without languages */
export function languageOf(state: PressState, pathname: string): string {
  const { i18n } = state.site;
  if (!i18n?.locales) return state.lang;
  const { defaultLanguage, hideLocale, locales } = i18n;
  const rules = { defaultLanguage, hideLocale, languages: locales.map((item) => item.locale) };
  return localeOf(rules, normalizePath(pathname)).lang ?? defaultLanguage;
}

/** whether the content has a page at a URL: a content page or the view of a plugin */
export async function hasPage(state: PressState, pathname: string): Promise<boolean> {
  return (await contentOf(state, normalizePath(pathname))) !== undefined;
}

export function usePress(): PressState {
  const state = inject(pressKey);
  if (!state) throw new Error("[Fumapress] `usePress()` is called outside of a Fumapress app.");
  return state;
}

/**
 * The components of compiled Markdown, by name: the `components` of the theme. A Markdown file reads them while it
 * renders, so a file that a page imports has them too.
 */
export function useMDXComponents(): Record<string, Component> {
  return inject(pressKey, undefined)?.theme.components ?? {};
}

/** loads the value of a data route of a plugin: with the page on the first render, by request afterwards */
export function useLoad(): Load {
  return usePress().load;
}

export function useSite(): Pick<SiteConfig, "name" | "description"> {
  return usePress().site.site;
}

/**
 * The page on screen: a content page or a view, none on custom pages and URLs without a page. `usePage<typeof app>()`
 * types it as one of the pages of the site, which narrow by their `type`.
 */
export function usePage<A extends Press<any, any> = never>(): Readonly<
  Ref<([A] extends [never] ? LoadedPage : PageOf<A, PressPageType<A>>) | undefined>
> {
  const { shown } = usePress();
  // the page is one of the site of `press.config`, which `A` names
  return computed(() => shown.value?.page as never);
}

export function usePageTree(): PageTree.Root {
  return usePress().site.tree;
}

/** the props of the layout of the content pages: `ui.layoutProps` of the site over those of plugins */
export function useLayoutProps(): LayoutProps {
  return usePress().site.layoutProps;
}

function isExternal(href: string): boolean {
  return /^([a-z][a-z0-9+.-]*:|\/\/)/i.test(href);
}

export const routerKey: InjectionKey<Router> = Symbol.for("fumapress:router");

function injectRouter(): Router {
  const router = inject(routerKey);
  if (!router) throw new Error("[Fumapress] The router is read outside of a Fumapress app.");
  return router;
}

/** whether a click on a link is the reader asking for the page in this tab */
function isPlainClick(event: MouseEvent): boolean {
  if (event.defaultPrevented || event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  const anchor = event.currentTarget as HTMLAnchorElement;
  return !anchor.hasAttribute("download") && (!anchor.target || anchor.target === "_self");
}

/** a link of the site: client-side navigation for its pages, a plain anchor for other URLs and hashes */
export const Link = defineComponent({
  name: "Link",
  inheritAttrs: false,
  props: {
    /** a path of the site without the base path, a hash, or the URL of another site */
    href: { type: String, default: "" },
    external: Boolean,
  },
  setup(props, { slots, attrs }) {
    const state = usePress();
    const router = injectRouter();
    const target = computed(() =>
      props.href.startsWith("/") ? router.resolve(props.href) : undefined,
    );
    // the page is requested when the reader shows intent, so the navigation doesn't wait for it
    const prefetch = () => target.value && prefetchPage(state, target.value.path);

    return () => {
      // a URL that would run a script has no `href`
      const href = safeHref(props.href);
      if (props.external || isExternal(props.href)) {
        return h(
          "a",
          { ...attrs, href, target: "_blank", rel: "noreferrer noopener" },
          slots.default?.(),
        );
      }
      const to = target.value;
      if (!to) return h("a", { ...attrs, href }, slots.default?.());

      return h(
        "a",
        mergeProps(attrs, {
          href: to.href,
          "aria-current": to.path === router.route.value.path ? "page" : undefined,
          onMouseenter: prefetch,
          onFocus: prefetch,
          onTouchstart: prefetch,
          onClick(event: MouseEvent) {
            if (!isPlainClick(event)) return;
            event.preventDefault();
            void router.push(props.href);
          },
        }),
        slots.default?.(),
      );
    };
  },
});

/**
 * The router of the app: `route` is the page on screen, with its `path`, `query`, `hash` and the `params` of a
 * custom page; `push()` and `replace()` go to a path of the site, written without the base path.
 */
export function useRouter(): Router {
  return injectRouter();
}

/**
 * Renders a URL outside the custom pages: its page with the component of `views` for its type, or the `NotFound` of
 * the theme. The fallback of the router.
 */
export const PageView = defineComponent({
  name: "PageView",
  setup() {
    const { shown, theme } = usePress();
    return () => {
      if (shown.value) return h(shown.value.component, { page: shown.value.page });
      if (!theme.NotFound) {
        throw new Error(
          "[Fumapress] The theme has no `NotFound`, which renders a URL without a page: add one, or extend the default theme.",
        );
      }
      return h(theme.NotFound);
    };
  },
});

/** renders the page the app is at */
export const RouterView = defineComponent({
  name: "RouterView",
  setup() {
    const { route } = injectRouter();
    return () => h(route.value.component);
  },
});
