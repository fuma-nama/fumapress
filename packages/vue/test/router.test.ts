import { expect, test } from "vitest";
import { createRouter, type RouteRecord } from "../src/router";

const Fallback = { name: "Fallback" };
const About = { name: "About" };
const Post = { name: "Post" };

const routes: RouteRecord[] = [
  { path: "/about", component: async () => ({ default: About }) },
  { path: "/blog/[slug]", component: async () => ({ default: Post }) },
];

const at = (url: string, base = "/") => createRouter({ base, url, routes, fallback: Fallback });

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

test("runs the guard before the first page shows", async () => {
  const seen: string[] = [];
  const router = await createRouter({
    base: "/",
    url: "/blog/first",
    routes,
    fallback: Fallback,
    beforeEach: (to) => void seen.push(`${to.path} ${String(to.params.slug)}`),
  });
  expect(seen).toEqual(["/blog/first first"]);
  expect(router.route.value.component).toBe(Post);
});
