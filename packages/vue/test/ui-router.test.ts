// @vitest-environment jsdom
// The router in the browser: links of the site navigate in the app, everything else is the browser's, and a navigation
// the app can't make falls back to a request of the document. `router.test.ts` covers what it resolves.
import { afterAll, afterEach, beforeEach, expect, test, vi } from "vitest";
import { createApp, h, nextTick, shallowRef, type Component, type VNodeChild } from "vue";
import {
  Link,
  RouterView,
  createLoad,
  createRouter,
  pressKey,
  routerKey,
  type AfterEachHook,
  type BeforeEachHook,
  type PressState,
  type RouterOptions,
} from "@fumapress/vue/client";
import { stubBrowser } from "./ui/dom";

stubBrowser();

// the scroll position of the window, which jsdom doesn't have
const scroll = { left: 0, top: 0 };
const scrollTo = vi.fn((options: ScrollToOptions) => {
  scroll.left = options.left ?? 0;
  scroll.top = options.top ?? 0;
});
vi.stubGlobal("scrollTo", scrollTo);
Object.defineProperty(window, "scrollX", { get: () => scroll.left, configurable: true });
Object.defineProperty(window, "scrollY", { get: () => scroll.top, configurable: true });

// a document load is `location.assign()`: jsdom can't load another document, the test sees that it was asked to
const real = window.location;
const assign = vi.fn();
const reload = vi.fn();
vi.stubGlobal("location", {
  get href() {
    return real.href;
  },
  get pathname() {
    return real.pathname;
  },
  get search() {
    return real.search;
  },
  get hash() {
    return real.hash;
  },
  assign,
  reload,
});

// a router listens to `window` as long as the page lives: the listeners of each test are removed after it
const listening: [string, EventListenerOrEventListenerObject][] = [];
const addEventListener = window.addEventListener;
window.addEventListener = ((
  type: string,
  listener: EventListenerOrEventListenerObject,
  options?: AddEventListenerOptions | boolean,
) => {
  listening.push([type, listener]);
  addEventListener.call(window, type, listener, options);
}) as typeof window.addEventListener;
afterAll(() => {
  window.addEventListener = addEventListener;
});

const cleanups: (() => void)[] = [];
beforeEach(() => {
  window.history.replaceState(null, "", "/");
  scroll.left = scroll.top = 0;
});
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  for (const [type, listener] of listening.splice(0)) window.removeEventListener(type, listener);
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

const Page: Component = { render: () => h("main", "page") };

/** a router at a URL, with hooks of the site, once it has loaded the first page */
async function router({
  beforeEach,
  afterEach,
  ...options
}: Partial<RouterOptions> & {
  url: string;
  beforeEach?: BeforeEachHook;
  afterEach?: AfterEachHook;
}) {
  window.history.replaceState(null, "", options.url);
  const created = createRouter({ base: "/", routes: [], fallback: Page, ...options });
  if (beforeEach) created.beforeEach(beforeEach);
  if (afterEach) created.afterEach(afterEach);
  await created.start();
  return created;
}

/** whether the browser would follow a click: its default wasn't prevented by the time it reached `window` */
function click(anchor: Element, init: MouseEventInit = {}): boolean {
  let followed = false;
  const listener = (event: Event) => {
    followed = !event.defaultPrevented;
    // jsdom can't load another document
    event.preventDefault();
  };
  window.addEventListener("click", listener);
  anchor.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, ...init }));
  window.removeEventListener("click", listener);
  return followed;
}

/** an app with links, like a page of the site */
async function mount(links: () => VNodeChild, base = "/") {
  const r = await router({ base, url: `${base}guide` });
  const state = {
    base,
    lang: "en",
    page: shallowRef(),
    components: {},
    views: {},
    load: vi.fn(async () => undefined),
  } as unknown as PressState;
  const container = document.createElement("div");
  document.body.append(container);
  const app = createApp({ render: () => [links(), h(RouterView)] });
  app.provide(pressKey, state);
  app.provide(routerKey, r);
  app.mount(container);
  cleanups.push(() => {
    app.unmount();
    container.remove();
  });
  return { router: r, container, state };
}

test("a click on a link of the site navigates in the app, with the base path", async () => {
  const { router, container } = await mount(
    () => h(Link, { href: "/install" }, () => "Install"),
    "/docs/",
  );
  const anchor = container.querySelector("a")!;
  expect(anchor.getAttribute("href")).toBe("/docs/install");
  const entries = window.history.length;

  expect(click(anchor)).toBe(false);
  await vi.waitFor(() => expect(router.route.value.path).toBe("/install"));
  expect(window.location.pathname).toBe("/docs/install");
  expect(window.history.length).toBe(entries + 1);
  expect(assign).not.toHaveBeenCalled();
  await nextTick();
  expect(anchor.getAttribute("aria-current")).toBe("page");
});

test("a click the reader means for another tab or a download is left to the browser", async () => {
  const { router, container } = await mount(() => [
    h(Link, { href: "/install" }, () => "plain"),
    h(Link, { href: "/install", target: "_blank" }, () => "new tab"),
    h(Link, { href: "/install", download: "" }, () => "download"),
    h(
      Link,
      { href: "/install", onClick: (event: Event) => event.preventDefault() },
      () => "handled",
    ),
    h(Link, { href: "https://example.com/install" }, () => "external"),
    h(Link, { href: "/install", external: true }, () => "marked external"),
  ]);
  const [plain, newTab, download, handled, external, markedExternal] =
    container.querySelectorAll("a");
  const entries = window.history.length;

  for (const modifier of ["metaKey", "ctrlKey", "shiftKey", "altKey"]) {
    expect(click(plain!, { [modifier]: true }), modifier).toBe(true);
  }
  expect(click(plain!, { button: 1 }), "middle button").toBe(true);
  expect(click(newTab!)).toBe(true);
  expect(click(download!)).toBe(true);
  expect(click(external!)).toBe(true);
  expect(external!.target).toBe("_blank");
  expect(click(markedExternal!)).toBe(true);
  // prevented by a handler of the page: neither the browser nor the app navigates
  expect(click(handled!)).toBe(false);

  await nextTick();
  expect(router.route.value.path).toBe("/guide");
  expect(window.history.length).toBe(entries);
});

test("a link to a URL that runs a script has no href", async () => {
  const hostile = [
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    " javascript:alert(1)",
    "\u0001javascript:alert(1)",
    "java\nscript:alert(1)",
    "java\tscript:alert(1)",
    "vbscript:msgbox(1)",
    "data:text/html,<script>alert(1)</script>",
  ];
  const safe = ["https://example.com", "mailto:hi@example.com", "#usage", "deploy"];
  const { container } = await mount(() => [
    ...hostile.map((href) => h(Link, { href }, () => "x")),
    h(Link, { href: "javascript:alert(1)", external: true }, () => "x"),
    ...safe.map((href) => h(Link, { href }, () => "x")),
  ]);
  const anchors = [...container.querySelectorAll("a")];

  for (const anchor of anchors.slice(0, hostile.length + 1)) {
    expect(anchor.hasAttribute("href"), anchor.outerHTML).toBe(false);
  }
  expect(anchors.slice(hostile.length + 1).map((anchor) => anchor.getAttribute("href"))).toEqual(
    safe,
  );
});

test("back restores the scroll position the reader left the page at", async () => {
  const r = await router({ url: "/a" });
  scroll.top = 500;
  await r.push("/b");
  // a new page starts at the top
  expect(scroll.top).toBe(0);

  scroll.top = 120;
  window.history.back();
  await vi.waitFor(() => expect(r.route.value.path).toBe("/a"));
  await vi.waitFor(() => expect(scroll.top).toBe(500));
});

test("forward restores the scroll position the reader left the page at", async () => {
  const r = await router({ url: "/a" });
  await r.push("/b");
  scroll.top = 120;
  window.history.back();
  await vi.waitFor(() => expect(r.route.value.path).toBe("/a"));

  window.history.forward();
  await vi.waitFor(() => expect(r.route.value.path).toBe("/b"));
  await nextTick();
  expect(scroll.top).toBe(120);
});

test("a navigation slower than a later one never shows", async () => {
  let finish!: () => void;
  const slow = new Promise<void>((resolve) => (finish = resolve));
  const committed: string[] = [];
  const shown: string[] = [];
  const r = await router({
    url: "/",
    async beforeEach(to, { first }) {
      if (first) return;
      if (to.path === "/slow") await slow;
      return () => void committed.push(to.path);
    },
    afterEach: (to) => void shown.push(to.path),
  });
  const entries = window.history.length;

  const toSlow = r.push("/slow");
  await r.push("/fast");
  finish();
  await toSlow;

  expect(r.route.value.path).toBe("/fast");
  expect(window.location.pathname).toBe("/fast");
  // what the slow navigation loaded is never applied, and it adds no entry to the history
  expect(committed).toEqual(["/fast"]);
  expect(shown).toEqual(["/fast"]);
  expect(window.history.length).toBe(entries + 1);
});

test("a hook sends a navigation to another path, and a removed hook no longer runs", async () => {
  const shown: string[] = [];
  const r = await router({ url: "/" });
  r.beforeEach((to) => (to.path === "/old" ? "/new?from=old" : undefined));
  const remove = r.afterEach((to) => void shown.push(to.path));
  const entries = window.history.length;

  await r.push("/old");
  expect(r.route.value).toMatchObject({ path: "/new", query: { from: "old" } });
  expect(window.location.pathname).toBe("/new");
  // one entry, for the page it went to
  expect(window.history.length).toBe(entries + 1);

  remove();
  await r.push("/other");
  expect(shown).toEqual(["/new"]);
});

test("a navigation to another anchor of the page loads nothing", async () => {
  const beforeEach = vi.fn(() => undefined);
  const component = vi.fn(async () => ({ default: Page }));
  const r = await router({ url: "/docs", routes: [{ path: "/docs", component }], beforeEach });
  const heading = document.createElement("h2");
  heading.id = "usage";
  heading.scrollIntoView = vi.fn();
  document.body.append(heading);
  cleanups.push(() => heading.remove());
  expect(beforeEach).toHaveBeenCalledTimes(1);

  await r.push("#usage");
  expect(r.route.value).toMatchObject({ path: "/docs", hash: "#usage" });
  expect(window.location.hash).toBe("#usage");
  expect(heading.scrollIntoView).toHaveBeenCalled();

  // a link of the page the browser follows by itself: the route follows the address bar
  real.hash = "#options";
  await vi.waitFor(() => expect(r.route.value.hash).toBe("#options"));

  expect(beforeEach).toHaveBeenCalledTimes(1);
  expect(component).toHaveBeenCalledTimes(1);
});

test("a navigation that fails to load asks the server for the page", async () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const component = vi
    .fn<() => Promise<{ default: Component }>>()
    .mockRejectedValueOnce(new Error("Failed to fetch dynamically imported module"))
    .mockResolvedValue({ default: Page });
  const r = await router({
    base: "/docs/",
    url: "/docs/",
    routes: [{ path: "/about", component }],
  });

  await r.push("/about?tab=team");
  expect(assign).toHaveBeenCalledWith("/docs/about?tab=team");
  expect(error).toHaveBeenCalled();
  expect(r.route.value.path).toBe("/");

  // the failed load isn't kept: the next navigation loads the page again
  await r.push("/about");
  expect(r.route.value.path).toBe("/about");
  expect(assign).toHaveBeenCalledTimes(1);
});

test("a guard that throws asks the server for the page too", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const r = await router({
    url: "/",
    beforeEach(to, { first }) {
      if (!first) throw new Error("the data of the page failed to load");
    },
  });

  await r.push("/guide");
  expect(assign).toHaveBeenCalledWith("/guide");
});

test("the data of the server is requested once, and again after a request that failed", async () => {
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(new Response("", { status: 500 }))
    .mockResolvedValueOnce(Response.json({ title: "My page" }))
    .mockResolvedValueOnce(new Response("", { status: 404 }))
    .mockRejectedValueOnce(new TypeError("Failed to fetch"))
    .mockResolvedValueOnce(Response.json({ title: "Offline" }));
  const load = createLoad("/docs/", { "/_press/site/en.json": { name: "Press" } });

  // what the server sent with the document needs no request
  expect(await load("/_press/site/en.json")).toEqual({ name: "Press" });
  expect(fetch).not.toHaveBeenCalled();

  // an error of the server is not kept, the value is
  expect(await load("/_press/pages/my page.json")).toBeUndefined();
  expect(await load("/_press/pages/my page.json")).toEqual({ title: "My page" });
  expect(await load("/_press/pages/my page.json")).toEqual({ title: "My page" });
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(fetch).toHaveBeenLastCalledWith("/docs/_press/pages/my%20page.json");

  // a path without a value is a 404 for good
  expect(await load("/_press/pages/missing.json")).toBeUndefined();
  expect(await load("/_press/pages/missing.json")).toBeUndefined();
  expect(fetch).toHaveBeenCalledTimes(3);

  // a request that never reached the server is made again
  expect(await load("/_press/pages/offline.json")).toBeUndefined();
  expect(await load("/_press/pages/offline.json")).toEqual({ title: "Offline" });
});
