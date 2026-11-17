import { expect, test } from "vitest";
import { createRouter, type RouteRecord } from "../src/router";

const Fallback = { name: "Fallback" };
const About = { name: "About" };
const Post = { name: "Post" };

const routes: RouteRecord[] = [
  { path: "/about", component: async () => ({ default: About }) },
  { path: "/blog/[slug]", component: async () => ({ default: Post }) },
];

async function at(url: string, base = "/") {
  const router = createRouter({ base, url, routes, fallback: Fallback });
  await router.start();
  return router;
}

test("starts at the URL of the request, with its page loaded", async () => {
  const about = await at("/about?tab=team#people");
  expect(about.route.value).toMatchObject({
    path: "/about",
    query: { tab: "team" },
    hash: "#people",
    params: {},
    href: "/about?tab=team#people",
    component: About,
  });

  const post = await at("/blog/hello%20world/");
  expect(post.route.value).toMatchObject({
    path: "/blog/hello world",
    params: { slug: "hello world" },
    href: "/blog/hello%20world",
    component: Post,
  });

  // a URL without a custom page renders with the fallback: a content page, a view or the not found page
  const content = await at("/guide/install");
  expect(content.route.value.record).toBeUndefined();
  expect(content.route.value.component).toBe(Fallback);
});

test("reads the address bar with the base path, and links without it", async () => {
  const router = await at("/docs/guide/install", "/docs/");
  expect(router.route.value.path).toBe("/guide/install");
  expect((await at("/docs", "/docs/")).route.value.path).toBe("/");
  await expect(at("/elsewhere", "/docs/")).rejects.toThrow("is not a URL of the site");

  // links are paths of the site: the base path is added to the URL they show
  expect(router.resolve("/about")).toMatchObject({ path: "/about", href: "/docs/about" });
  expect(router.resolve("/")).toMatchObject({ path: "/", href: "/docs/" });
  // relative to the page
  expect(router.resolve("?page=2")).toMatchObject({ path: "/guide/install", query: { page: "2" } });
  expect(router.resolve("#usage")).toMatchObject({ path: "/guide/install", hash: "#usage" });
  expect(router.resolve("deploy")).toMatchObject({ path: "/guide/deploy" });
});

test("leaves other sites to the browser", async () => {
  const router = await at("/");
  expect(router.resolve("https://example.com/about")).toBeUndefined();
  expect(router.resolve("//example.com/about")).toBeUndefined();
  expect(router.resolve("mailto:hi@example.com")).toBeUndefined();
  // repeated slashes in a path of the site are not a host
  expect(router.resolve("/about//")).toMatchObject({ path: "/about" });
});

test("runs the hooks before the first page shows, in the order they were added", async () => {
  const seen: string[] = [];
  const router = createRouter({ base: "/", url: "/blog/first", routes, fallback: Fallback });
  router.beforeEach((to, { first }) => void seen.push(`${to.path} ${to.params.slug} ${first}`));
  const remove = router.beforeEach(() => void seen.push("removed"));
  router.beforeEach(() => void seen.push("last"));
  remove();
  await router.start();
  expect(seen).toEqual(["/blog/first first true", "last"]);
  expect(router.route.value.component).toBe(Post);
});

test("a hook sends the first page to another path, or cancels it", async () => {
  const redirected = createRouter({ base: "/docs/", url: "/docs/old", routes, fallback: Fallback });
  redirected.beforeEach((to) => (to.path === "/old" ? "/about" : undefined));
  await redirected.start();
  expect(redirected.route.value).toMatchObject({
    path: "/about",
    href: "/docs/about",
    component: About,
  });

  // a cancelled first navigation renders nothing
  const cancelled = createRouter({ base: "/", url: "/about", routes, fallback: Fallback });
  cancelled.beforeEach(() => false);
  await cancelled.start();
  expect(cancelled.route.value.component).toBe(Fallback);

  const loop = createRouter({ base: "/", url: "/a", routes, fallback: Fallback });
  loop.beforeEach((to) => (to.path === "/a" ? "/b" : "/a"));
  await expect(loop.start()).rejects.toThrow("a loop of redirects");
});

test("a page of the content wins over a custom page with params, and loses to one at a fixed path", async () => {
  const pages = new Set(["/blog/hello", "/about"]);
  const router = async (url: string) => {
    const created = createRouter({
      base: "/",
      url,
      routes: [...routes, { path: "/[...all]", component: async () => ({ default: Post }) }],
      fallback: Fallback,
      hasPage: (path) => pages.has(path),
    });
    await created.start();
    return created;
  };

  // the content has this page: it is more specific than `[slug]`
  const content = (await router("/blog/hello")).route.value;
  expect(content).toMatchObject({ component: Fallback, params: {} });
  expect(content.record).toBeUndefined();
  // it has no page here, so the custom page answers
  expect((await router("/blog/other")).route.value).toMatchObject({
    component: Post,
    params: { slug: "other" },
  });
  // a path nothing else has goes to the page that takes the rest
  expect((await router("/nope/at/all")).route.value.params).toEqual({ all: "nope/at/all" });
  // a custom page at a fixed path is the most specific
  expect((await router("/about")).route.value.component).toBe(About);
});
