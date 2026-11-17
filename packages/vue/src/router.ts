import { nextTick, shallowRef, type Component, type ShallowRef } from "vue";
import { decodePath, encodePath, matchRoute, safeHref } from "./core/routes";
import type { Awaitable } from "./core/types";

/** a page of the app outside the content: a `.vue` file of `src/pages` */
export interface RouteRecord {
  /** without the base path; `[name]` matches a segment, `[...name]` the rest, like the routes of plugins */
  path: string;
  /** loads the component of the page */
  component: () => Promise<{ default: Component }>;
  /** loads the styles of the page, for the document the server renders */
  assets?: () => Promise<{ default: unknown }>;
}

/** where the app is */
export interface Route {
  /** the path of the page, without the base path */
  path: string;
  query: Record<string, string>;
  /** with its `#`, empty without one */
  hash: string;
  /** the values of the params of a custom page */
  params: Record<string, string>;
  /** the URL in the address bar: with the base path, the query and the hash */
  href: string;
  /** the custom page it matched; without one, the route of content pages and views */
  record?: RouteRecord;
  component: Component;
}

export interface RouterOptions {
  /** the base path of the site, with a trailing slash */
  base: string;
  /** the URL the app starts at: path, query and hash, with the base path */
  url: string;
  routes: RouteRecord[];
  /** renders every URL without a custom page: content pages, views, and the not found page */
  fallback: Component;
  /**
   * Runs before a page shows, to load what it renders: `first` for the page the app starts at. `false` cancels the
   * navigation. A function it returns is called when the navigation wins, to apply what was loaded: a slower
   * navigation the reader has left never does.
   */
  beforeEach?: (to: Route, env: { first: boolean }) => Awaitable<void | false | (() => void)>;
  /** runs when the app moved to another page */
  afterEach?: (to: Route) => void;
}

export interface Router {
  /** the page on screen */
  readonly route: Readonly<ShallowRef<Route>>;
  /** where a link leads, none when it leaves the site */
  resolve: (href: string) => Omit<Route, "component"> | undefined;
  push: (href: string) => Promise<void>;
  replace: (href: string) => Promise<void>;
  back: () => void;
  forward: () => void;
  /** scroll where the reader was, after a reload: call it once the app is mounted */
  restoreScroll: () => void;
}

/** stands in for the origin of the site: a link resolving to another one leaves the site */
const SITE = "http://site.invalid";

/** the scroll positions of the history entries of a tab, in its session storage */
const SCROLL_STORE = "press:scroll";

interface Scroll {
  left: number;
  top: number;
}

/**
 * The router of the app: custom pages by their path, and one route for everything else. It loads a page before
 * showing it, so the server and the browser render it in one pass, and a navigation that fails falls back to a
 * request to the server.
 */
export async function createRouter(options: RouterOptions): Promise<Router> {
  const { base, routes, fallback } = options;
  const inBrowser = typeof window !== "undefined";
  const components = new Map<RouteRecord, Promise<Component>>();
  let current = 0;

  /** a link of the site: a path without the base path, or a URL relative to the page at `from` */
  function resolve(href: string, from: string): Omit<Route, "component"> | undefined {
    let url: URL;
    try {
      url = new URL(href, SITE + encodePath(from));
    } catch {
      return;
    }
    // a full URL, or `//host`: another site
    if (url.origin !== SITE) return;
    // none for a path that can't name a page, like one with a malformed escape
    const path = decodePath(url.pathname);
    if (path === undefined) return;

    const route = {
      path,
      query: Object.fromEntries(url.searchParams),
      hash: url.hash,
      href: base + encodePath(path).slice(1) + url.search + url.hash,
    };
    for (const record of routes) {
      const params = matchRoute(record.path, path);
      if (params) return { ...route, params, record };
    }
    return { ...route, params: {} };
  }

  /** a URL of the address bar: with the base path, none outside of it */
  function fromLocation(url: string): Omit<Route, "component"> | undefined {
    const [, pathname = "", rest = ""] = /^([^?#]*)(.*)$/.exec(url) ?? [];
    if (pathname + "/" === base) return resolve(`/${rest}`, "/");
    if (pathname.startsWith(base)) return resolve(pathname.slice(base.length - 1) + rest, "/");
  }

  function componentOf(record: RouteRecord | undefined): Awaitable<Component> {
    if (!record) return fallback;
    let component = components.get(record);
    if (!component) {
      component = record.component().then((mod) => mod.default);
      components.set(record, component);
      // a failed load is tried again by the next navigation
      component.catch(() => components.delete(record));
    }
    return component;
  }

  /** the route with what it renders loaded, and what applies it; none when the navigation is cancelled */
  async function load(
    target: Omit<Route, "component">,
    first = false,
  ): Promise<{ route: Route; commit?: () => void } | undefined> {
    const route: Route = { ...target, component: await componentOf(target.record) };
    const result = await options.beforeEach?.(route, { first });
    if (result === false) return;
    return { route, commit: result || undefined };
  }

  const initial = fromLocation(options.url);
  if (!initial) throw new Error(`[Fumapress] "${options.url}" is not a URL of the site.`);
  const first = await load(initial, true);
  first?.commit?.();
  // a cancelled first navigation leaves the document: nothing renders
  const route = shallowRef<Route>(first?.route ?? { ...initial, component: fallback });

  const currentScroll = (): Scroll => ({ left: window.scrollX, top: window.scrollY });

  // Where the reader was on each entry of the history, for when they come back to it. An entry is named by the key
  // in its state, since the entry being left by back or forward can no longer be written to.
  const positions = new Map<number, Scroll>();
  let entry = 0;
  let lastKey = Date.now();
  /** the key of the entry the browser is at: an entry it made itself, for an anchor of the page, gets one */
  function currentEntry(): number {
    const state = window.history.state;
    if (typeof state?.key === "number") return state.key;
    const key = ++lastKey;
    window.history.replaceState({ ...state, key }, "");
    return key;
  }

  function scrollTo(target: Route, saved?: Scroll) {
    if (saved) return window.scrollTo(saved);
    if (target.hash) {
      let id = target.hash.slice(1);
      try {
        id = decodeURIComponent(id);
      } catch {
        // keep it as written
      }
      // the offset of a heading under a fixed header is its `scroll-margin`
      const element = document.getElementById(id);
      if (element) return element.scrollIntoView();
    }
    window.scrollTo({ left: 0, top: 0 });
  }

  const sameDocument = (a: Route, b: Omit<Route, "component">) =>
    a.path === b.path && JSON.stringify(a.query) === JSON.stringify(b.query);

  async function navigate(
    target: Omit<Route, "component">,
    mode: "push" | "replace" | "pop",
  ): Promise<void> {
    const id = ++current;
    const from = route.value;
    // read now: loading the next page can already change the height of the document
    const leaving = currentScroll();
    // another anchor of the same page: nothing to load
    const loaded = sameDocument(from, target)
      ? { route: { ...target, component: from.component } }
      : await load(target);
    // cancelled, or the reader went elsewhere meanwhile
    if (!loaded || id !== current) return;
    const { route: next, commit } = loaded as { route: Route; commit?: () => void };

    positions.set(entry, leaving);
    if (mode === "push") {
      entry = ++lastKey;
      window.history.pushState({ key: entry }, "", next.href);
    } else if (mode === "replace") {
      window.history.replaceState(window.history.state, "", next.href);
    } else {
      entry = currentEntry();
    }
    const saved = mode === "pop" ? positions.get(entry) : undefined;
    commit?.();
    route.value = next;
    options.afterEach?.(next);

    await nextTick();
    if (id === current) scrollTo(next, saved);
  }

  /** a navigation by a link or by code: the server answers when the app can't, like after a deployment */
  async function go(href: string, mode: "push" | "replace"): Promise<void> {
    const target = resolve(href, route.value.path);
    if (!inBrowser) return;
    // another site: the browser goes there, unless the URL would run a script
    if (!target) {
      const safe = safeHref(href);
      if (safe !== undefined) window.location.assign(safe);
      return;
    }
    try {
      await navigate(target, mode);
    } catch (error) {
      console.error(error);
      window.location.assign(target.href);
    }
  }

  if (inBrowser) {
    // the app restores the scroll position itself, once the page it goes back to is rendered
    window.history.scrollRestoration = "manual";
    entry = currentEntry();
    // the positions outlive a reload in the storage of the tab, when the browser allows it
    try {
      for (const [key, scroll] of JSON.parse(sessionStorage.getItem(SCROLL_STORE) ?? "[]")) {
        positions.set(key, scroll);
      }
    } catch {
      // start without them
    }
    window.addEventListener("pagehide", () => {
      positions.set(entry, currentScroll());
      try {
        sessionStorage.setItem(SCROLL_STORE, JSON.stringify([...positions]));
      } catch {
        // a reload starts at the top
      }
    });
    // a click on an anchor of the page is the browser's: the route follows the address bar
    window.addEventListener("hashchange", () => {
      const { pathname, search, hash } = window.location;
      const target = fromLocation(pathname + search + hash);
      entry = currentEntry();
      if (target && target.href !== route.value.href && sameDocument(route.value, target)) {
        route.value = { ...target, component: route.value.component };
      }
    });
    window.addEventListener("popstate", () => {
      const { pathname, search, hash } = window.location;
      const target = fromLocation(pathname + search + hash);
      if (!target) return window.location.reload();
      navigate(target, "pop").catch((error) => {
        console.error(error);
        window.location.reload();
      });
    });
  }

  return {
    route,
    resolve: (href) => resolve(href, route.value.path),
    push: (href) => go(href, "push"),
    replace: (href) => go(href, "replace"),
    back: () => window.history.back(),
    forward: () => window.history.forward(),
    restoreScroll() {
      const saved = positions.get(entry);
      if (saved) window.scrollTo(saved);
    },
  };
}
