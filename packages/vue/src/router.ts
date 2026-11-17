import { nextTick, shallowRef, type Component, type ShallowRef } from "vue";
import { decodePath, encodePath, hasParams, matchRoute, safeHref } from "./core/routes";
import type { Awaitable, ClientAssets } from "./core/types";

/** a page of the app outside the content: a `.vue` file of `src/pages` */
export interface RouteRecord {
  /** without the base path; `[name]` matches a segment, `[...name]` the rest, like the routes of plugins */
  path: string;
  /** loads the component of the page */
  component: () => Promise<{ default: Component }>;
  /** loads the styles of the page, for the document the server renders */
  assets?: () => Promise<{ default: ClientAssets }>;
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
  /** the custom page that renders it; without one, the route of content pages and views */
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
   * Whether `fallback` has a page at a path. A custom page with params only answers the paths without one: a page
   * of the content is more specific than a param, as a custom page at a fixed path is more specific than both.
   */
  hasPage?: (path: string) => Awaitable<boolean>;
}

/**
 * Runs before a page shows, in the order hooks were added: `first` for the page the app starts at, on the server and in
 * the browser. It returns `false` to cancel the navigation, or a path of the site to go there instead. A function it
 * returns is called when the navigation wins, to apply what the hook loaded: a slower navigation the reader has left
 * never does.
 */
export type BeforeEachHook = (
  to: Route,
  env: { first: boolean },
) => Awaitable<void | false | string | (() => void)>;

/** runs when the app moved to another page, in the browser: not for the page it starts at */
export type AfterEachHook = (to: Route) => void;

export interface Router {
  /** the page on screen */
  readonly route: Readonly<ShallowRef<Route>>;
  /** where a link leads, none when it leaves the site */
  resolve: (href: string) => Omit<Route, "component"> | undefined;
  push: (href: string) => Promise<void>;
  replace: (href: string) => Promise<void>;
  back: () => void;
  forward: () => void;
  /** adds a hook that runs before a page shows, and returns a function that removes it */
  beforeEach: (hook: BeforeEachHook) => () => void;
  /** adds a hook that runs when the app moved to another page, and returns a function that removes it */
  afterEach: (hook: AfterEachHook) => () => void;
  /** loads the page the app starts at: the app calls it once, after the hooks are added */
  start: () => Promise<void>;
  /** scroll where the reader was, after a reload: call it once the app is mounted */
  restoreScroll: () => void;
}

/** stands in for the origin of the site: a link resolving to another one leaves the site */
const SITE = "http://site.invalid";

/** the scroll positions of the history entries of a tab, in its session storage */
const SCROLL_STORE = "press:scroll";

/** how many times the hooks of one navigation can redirect it: more is a loop */
const MAX_REDIRECTS = 10;

interface Scroll {
  left: number;
  top: number;
}

/**
 * The router of the app: custom pages by their path, and one route for everything else. It loads a page before
 * showing it, so the server and the browser render it in one pass, and a navigation that fails falls back to a
 * request to the server.
 */
export function createRouter(options: RouterOptions): Router {
  const { base, routes, fallback } = options;
  const inBrowser = typeof window !== "undefined";
  const components = new Map<RouteRecord, Promise<Component>>();
  const beforeHooks = new Set<BeforeEachHook>();
  const afterHooks = new Set<AfterEachHook>();
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

  /**
   * The route with what it renders loaded, and what applies it: the one a hook redirects to, if any. None when the
   * navigation is cancelled.
   */
  async function load(
    target: Omit<Route, "component">,
    first = false,
    redirects = 0,
  ): Promise<{ route: Route; commit: () => void } | undefined> {
    let { record } = target;
    if (record && hasParams(record.path) && (await options.hasPage?.(target.path))) {
      record = undefined;
    }
    const route: Route = {
      ...target,
      params: record ? target.params : {},
      record,
      component: await componentOf(record),
    };

    const commits: (() => void)[] = [];
    for (const hook of beforeHooks) {
      const result = await hook(route, { first });
      if (result === false) return;
      if (typeof result === "function") commits.push(result);
      else if (typeof result === "string") {
        const next = resolve(result, route.path);
        if (!next || redirects >= MAX_REDIRECTS) {
          throw new Error(
            `[Fumapress] A \`beforeEach\` hook sent "${route.path}" to "${result}", which is ${next ? "a loop of redirects" : "not a path of the site"}.`,
          );
        }
        return load(next, first, redirects + 1);
      }
    }
    return { route, commit: () => commits.forEach((commit) => commit()) };
  }

  const initial = fromLocation(options.url);
  if (!initial) throw new Error(`[Fumapress] "${options.url}" is not a URL of the site.`);
  // until `start()` loads it; a cancelled first navigation leaves the document, so nothing renders
  const route = shallowRef<Route>({ ...initial, component: fallback });
  let started: Promise<void> | undefined;

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
      ? { route: { ...target, component: from.component }, commit: () => {} }
      : await load(target);
    // cancelled, or the reader went elsewhere meanwhile
    if (!loaded || id !== current) return;
    const { route: next, commit } = loaded;

    positions.set(entry, leaving);
    if (mode === "push") {
      entry = ++lastKey;
      window.history.pushState({ key: entry }, "", next.href);
    } else if (mode === "replace") {
      window.history.replaceState(window.history.state, "", next.href);
    } else {
      entry = currentEntry();
      // the browser is at the entry: a redirect of a hook shows the page it went to
      if (next.href !== target.href)
        window.history.replaceState(window.history.state, "", next.href);
    }
    const saved = mode === "pop" ? positions.get(entry) : undefined;
    commit();
    route.value = next;
    for (const hook of afterHooks) hook(next);

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

  /** adds a hook to a set, and returns a function that removes it */
  const add =
    <T>(hooks: Set<T>) =>
    (hook: T) => {
      hooks.add(hook);
      return () => void hooks.delete(hook);
    };

  return {
    route,
    resolve: (href) => resolve(href, route.value.path),
    push: (href) => go(href, "push"),
    replace: (href) => go(href, "replace"),
    beforeEach: add(beforeHooks),
    afterEach: add(afterHooks),
    start() {
      started ??= load(initial, true).then((loaded) => {
        if (!loaded) return;
        loaded.commit();
        route.value = loaded.route;
        // a redirect of a hook: the address bar shows the page it went to
        if (inBrowser && loaded.route.href !== initial.href) {
          window.history.replaceState(window.history.state, "", loaded.route.href);
        }
      });
      return started;
    },
    back: () => window.history.back(),
    forward: () => window.history.forward(),
    restoreScroll() {
      const saved = positions.get(entry);
      if (saved) window.scrollTo(saved);
    },
  };
}
