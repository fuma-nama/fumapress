import {
  computed,
  defineComponent,
  h,
  inject,
  mergeProps,
  shallowRef,
  type App,
  type Component,
  type ComputedRef,
  type InjectionKey,
  type ShallowRef,
} from "vue";
import type { Router } from "./router";
import { localeOf, localizePath, type LocaleRules } from "./core/i18n";
import {
  encodePath,
  normalizePath,
  safeHref,
  pageDataPath,
  searchIndexPath,
  siteDataPath,
} from "./core/routes";
import type {
  HeadTag,
  LayoutProps,
  Load,
  PageContent,
  PageData,
  PageModule,
  PageTree,
  SiteConfig,
  SiteData,
  SiteI18n,
} from "./core/types";

export { normalizePath, safeHref, searchIndexPath };

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
  type Route,
  type RouteRecord,
  type Router,
  type RouterOptions,
} from "./router";
export { searchIndex, type SearchEntry, type SearchResult } from "./core/search";
export type {
  HeadTag,
  LayoutProps,
  Load,
  NavLink,
  PageData,
  PageTree,
  SiteData,
  SiteI18n,
  TOCItem,
} from "./core/types";

/** the page on screen: what the server sent, with its body as a component */
export interface LoadedPage extends Omit<PageContent, "body"> {
  /** the content: compiled Markdown takes the components of the theme as its `components` prop */
  Content: Component;
  /** on the page of a plugin, the type of its view: `Content` is the component of `views`, with its own layout */
  view?: string;
}

/**
 * The UI of a site: `Layout` renders every content page and view, `components` are available in Markdown by name. A
 * theme module is loaded on the server and in the browser.
 */
export interface Theme {
  /** around every page of the app, custom pages too: its default slot is the page. For providers. */
  Root?: Component;
  Layout: Component;
  components?: Record<string, Component>;
  /** the components rendering the pages of plugins, by the `type` of their view: each renders its own layout */
  views?: Record<string, Component>;
  /** the icons of the page tree by name: an `icon` of a page or a folder without one here stays text, like an emoji */
  icons?: Record<string, Component>;
  /** tags of every page, like a script that runs before the first paint */
  head?: HeadTag[];
  /** register plugins and global components */
  enhanceApp?: (ctx: { app: App; router: Router }) => void;
}

export interface PressState {
  /** the base path of the site, with a trailing slash */
  base: string;
  /** the language of the document: another language is another document */
  lang: string;
  /** the data every page of the language needs: the site's info, the layout props and the page tree */
  site: SiteData;
  page: ShallowRef<LoadedPage | undefined>;
  components: Record<string, Component>;
  views: Record<string, Component>;
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
  base: string,
  lang: string,
  load: Load,
  theme: Theme,
): Promise<PressState> {
  const site = await load<SiteData>(siteDataPath(lang));
  if (!site) throw new Error("[Fumapress] The data of the site failed to load.");

  return {
    base,
    lang,
    site: theme.icons ? { ...site, tree: withIcons(site.tree, theme.icons) } : site,
    page: shallowRef(),
    components: theme.components ?? {},
    views: theme.views ?? {},
    load,
  };
}

function contentOf(state: PressState, url: string): Promise<PageContent | undefined> {
  return state.load<PageContent>(pageDataPath(url));
}

/** the component of a body: the server has the module, the browser imports it by its URL */
async function bodyOf(state: PressState, { body }: PageContent): Promise<Component> {
  if ("html" in body) return () => h("div", { innerHTML: body.html });
  if ("view" in body) {
    const { type, props } = body.view;
    const View = state.views[type];
    if (!View) {
      throw new Error(
        `[Fumapress] No component renders the view "${type}": add it to \`views\` of the theme.`,
      );
    }
    return () => h(View, props);
  }
  const mod: PageModule = await (body.load?.() ?? import(/* @vite-ignore */ body.module));
  return mod.default as Component;
}

/** the page of a URL, ready to render: a content page or the view of a plugin, none when the URL has neither */
export async function loadPage(
  state: PressState,
  pathname: string,
): Promise<LoadedPage | undefined> {
  const url = normalizePath(pathname);
  const content = await contentOf(state, url);
  return (
    content && {
      url,
      data: content.data,
      toc: content.toc,
      head: content.head,
      Content: await bodyOf(state, content),
      view: "view" in content.body ? content.body.view.type : undefined,
    }
  );
}

/** requests the content of a page ahead of a navigation, like when a link to it is hovered */
export function prefetchPage(state: PressState, pathname: string): void {
  void contentOf(state, normalizePath(pathname)).then(
    (content) => content && bodyOf(state, content),
  );
}

function rulesOf({ defaultLanguage, hideLocale, locales }: SiteI18n): LocaleRules {
  return { defaultLanguage, hideLocale, languages: locales.map((item) => item.locale) };
}

/** the language of a URL of the site: the one of the document without languages */
export function languageOf(state: PressState, pathname: string): string {
  const { i18n } = state.site;
  if (!i18n) return state.lang;
  return localeOf(rulesOf(i18n), normalizePath(pathname)).lang ?? i18n.defaultLanguage;
}

/** a URL of the site in another language: the same page there, when it has one */
export function translatePath(state: PressState, lang: string, pathname: string): string {
  const { i18n } = state.site;
  if (!i18n) return pathname;
  const rules = rulesOf(i18n);
  return localizePath(rules, lang, localeOf(rules, normalizePath(pathname)).pathname);
}

export function usePress(): PressState {
  const state = inject(pressKey);
  if (!state) throw new Error("[Fumapress] `usePress()` is called outside of a Fumapress app.");
  return state;
}

/** loads the value of a data route of a plugin: with the page on the first render, by request afterwards */
export function useLoad(): Load {
  return usePress().load;
}

export function useSite(): Pick<SiteConfig, "name" | "description"> {
  return usePress().site.site;
}

/** the content page on screen, undefined on custom pages and the not found page */
export function usePage(): ShallowRef<LoadedPage | undefined> {
  return usePress().page;
}

export function usePageTree(): PageTree.Root {
  return usePress().site.tree;
}

export function useLayoutProps(): LayoutProps {
  return usePress().site.layout;
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

export interface PressRouter {
  /** the path of the page, without the base path */
  path: ComputedRef<string>;
  query: ComputedRef<Record<string, string>>;
  hash: ComputedRef<string>;
  /** the values of the params of a custom page, like `slug` of `src/pages/blog/[slug].vue` */
  params: ComputedRef<Record<string, string>>;
  /** the URL of a page for the address bar, with the base path: none for a URL that leaves the site */
  resolve: (href: string) => string | undefined;
  /** go to a page: a path of the site without the base path */
  push: (href: string) => Promise<void>;
  replace: (href: string) => Promise<void>;
  back: () => void;
  forward: () => void;
}

export function useRouter(): PressRouter {
  const { route, resolve, push, replace, back, forward } = injectRouter();
  return {
    path: computed(() => route.value.path),
    query: computed(() => route.value.query),
    hash: computed(() => route.value.hash),
    params: computed(() => route.value.params),
    resolve: (href) => resolve(href)?.href,
    push,
    replace,
    back,
    forward,
  };
}

/** renders the page the app is at */
export const RouterView = defineComponent({
  name: "RouterView",
  setup() {
    const { route } = injectRouter();
    return () => h(route.value.component);
  },
});
