import { describe, expect, it } from "vitest";
import type { AppContext } from "@/app/context";
import type { RouteFns } from "@/lib/types";
import { blogPlugin, getBlogPosts, tagSlug } from "@/plugins/blog";
import { adjacentPosts, groupTags } from "@/lib/shared/blog";

function post(url: string, data: { date?: string; tags?: string[] }) {
  return { type: "blog", url, slugs: url.split("/").slice(2), data: { title: url, ...data } };
}

const pages = [
  post("/blog/a", { date: "2026-01-01", tags: ["React"] }),
  post("/blog/b", { date: "2026-03-01", tags: ["react", "Hello World"] }),
  post("/blog/c", {}),
  { type: "docs", url: "/docs", slugs: [], data: { title: "Docs" } },
];

const ctx = {
  mode: "default",
  adapters: [{ "blog:get-tags": (page: { data: { tags?: string[] } }) => page.data.tags }],
  getLoader: () => ({ getPages: () => pages }),
  getPageCreatedAt: (page: { data: { date?: string } }) =>
    page.data.date ? new Date(page.data.date) : undefined,
} as unknown as AppContext;

/** register the plugin's routes and run `fn` inside the blog context */
async function withBlog<T>(fn: () => Promise<T>) {
  let interceptor!: <R>(next: () => Promise<R>) => Promise<R>;
  const staticPaths = new Map<string, unknown>();

  await blogPlugin().createPages!.call(ctx, {
    createInterceptor: (i) => {
      interceptor = i;
    },
    createPage: (page) => {
      staticPaths.set(page.path, "staticPaths" in page ? page.staticPaths : undefined);
    },
    createLayout: () => {},
  } as unknown as RouteFns);

  return { staticPaths, result: await interceptor(fn) };
}

describe("tag slugs", () => {
  it("lowercases and encodes", () => {
    expect(tagSlug("Hello World")).toBe("hello%20world");
    expect(tagSlug("React")).toBe("react");
  });

  it("groups tags case-insensitively, keeping the first spelling", async () => {
    const grouped = await groupTags(ctx, pages.slice(0, 3));

    expect(Array.from(grouped)).toEqual([
      ["react", { tag: "React", count: 2 }],
      ["hello%20world", { tag: "Hello World", count: 1 }],
    ]);
  });

  it("registers tag routes with slugs", async () => {
    const { staticPaths } = await withBlog(async () => {});

    expect(staticPaths.get("/(blog)/blog/tags/[tag]")).toEqual(["react", "hello%20world"]);
  });
});

describe("blog posts", () => {
  it("sorts newest first, undated posts on top", async () => {
    const { result } = await withBlog(() => getBlogPosts(ctx));

    expect(result.map((post) => post.page.url)).toEqual(["/blog/c", "/blog/b", "/blog/a"]);
    expect(result[1].date).toEqual(new Date("2026-03-01"));
  });

  it("finds adjacent posts", async () => {
    const { result: posts } = await withBlog(() => getBlogPosts(ctx));

    expect(adjacentPosts(posts, pages[1]).newer?.page.url).toBe("/blog/c");
    expect(adjacentPosts(posts, pages[1]).older?.page.url).toBe("/blog/a");
    expect(adjacentPosts(posts, pages[2]).newer).toBeUndefined();
    expect(adjacentPosts(posts, pages[2]).older?.page.url).toBe("/blog/b");
    expect(adjacentPosts(posts, pages[3])).toEqual({});
  });
});
