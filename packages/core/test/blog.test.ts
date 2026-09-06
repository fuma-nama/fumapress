import { describe, expect, it } from "vitest";
import type { Page, PageData } from "fumadocs-core/source";
import type { AppContext, AppShape } from "@/app/context";
import type { RouteFns } from "@/lib/types";
import { blogPlugin, getAdjacentPosts, getBlogPosts, tagSlug } from "@/plugins/blog";
import { groupTags } from "@/lib/shared/blog";

interface Data extends PageData {
  date?: string;
  tags?: string[];
}

interface Shape extends AppShape {
  page: Page<string, Data>;
}

function mockPage(type: string, url: string, data: Data = {}): Shape["page"] {
  return { type, path: `${url.slice(1)}.mdx`, url, slugs: url.split("/").slice(2), data };
}

const a = mockPage("blog", "/blog/a", { date: "2026-01-01", tags: ["React"] });
const b = mockPage("blog", "/blog/b", { date: "2026-03-01", tags: ["react", "Hello World"] });
const c = mockPage("blog", "/blog/c");
const docs = mockPage("docs", "/docs");
const pages = [a, b, c, docs];

const ctx = {
  mode: "default",
  adapters: [{ "blog:get-tags": (page: Shape["page"]) => page.data.tags }],
  getLoader: () => ({ getPages: () => pages }),
  getPageCreatedAt: (page: Shape["page"]) =>
    page.data.date ? new Date(page.data.date) : undefined,
} as unknown as AppContext<Shape>;

/** register the plugin's routes and run `fn` inside the blog context */
async function withBlog<T>(fn: () => Promise<T>) {
  let interceptor!: <R>(next: () => Promise<R>) => Promise<R>;
  const staticPaths = new Map<string, unknown>();

  await blogPlugin<Shape>().createPages!.call(ctx, {
    createInterceptor: (i: typeof interceptor) => {
      interceptor = i;
    },
    createPage: (page: { path: string; staticPaths?: unknown }) => {
      staticPaths.set(page.path, page.staticPaths);
    },
    createLayout: () => {},
  } as unknown as RouteFns);

  return { staticPaths, result: await interceptor(fn) };
}

describe("tag slugs", () => {
  it("lowercases and dashes whitespace", () => {
    expect(tagSlug("Hello World")).toBe("hello-world");
    expect(tagSlug("React")).toBe("react");
  });

  it("groups tags case-insensitively, keeping the first spelling", async () => {
    const grouped = await groupTags(ctx, [a, b, c]);

    expect(Array.from(grouped)).toEqual([
      ["react", { tag: "React", count: 2 }],
      ["hello-world", { tag: "Hello World", count: 1 }],
    ]);
  });

  it("registers tag routes with slugs", async () => {
    const { staticPaths } = await withBlog(async () => {});

    expect(staticPaths.get("/(blog)/blog/tags/[tag]")).toEqual(["react", "hello-world"]);
  });
});

describe("blog posts", () => {
  it("sorts newest first, undated posts on top", async () => {
    const { result } = await withBlog(() => getBlogPosts(ctx));

    expect(result.map((post) => post.page.url)).toEqual(["/blog/c", "/blog/b", "/blog/a"]);
    expect(result[1]?.date).toEqual(new Date("2026-03-01"));
  });

  it("finds adjacent posts", async () => {
    const { result } = await withBlog(() =>
      Promise.all([
        getAdjacentPosts(ctx, b),
        getAdjacentPosts(ctx, c),
        getAdjacentPosts(ctx, docs),
      ]),
    );

    expect(result[0].newer?.page.url).toBe("/blog/c");
    expect(result[0].older?.page.url).toBe("/blog/a");
    expect(result[1].newer).toBeUndefined();
    expect(result[1].older?.page.url).toBe("/blog/b");
    expect(result[2]).toEqual({});
  });
});
