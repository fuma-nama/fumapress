import { describe, expect, it, vi } from "vitest";
import type { Page, PageData } from "fumadocs-core/source";
import { appContext, type AppContext, type AppShape } from "@/app/context";
import type { RouteFns } from "@/lib/types";
import { blogPlugin, getBlogPosts, tagSlug } from "@/plugins/blog";
import { adjacentPosts, groupTags } from "@/lib/shared/blog";
import { createBlogTagPage } from "@/layouts/blog.tags";

vi.mock("waku/router/server", () => ({
  unstable_notFound() {
    throw new Error("not found");
  },
}));

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
    createPageI18n: (page: { path: string; staticPaths?: unknown }) => {
      const { staticPaths: paths } = page;
      staticPaths.set(page.path, typeof paths === "function" ? paths(undefined) : paths);
    },
    createLayoutI18n: () => {},
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
    const { result: posts } = await withBlog(() => getBlogPosts(ctx));

    expect(adjacentPosts(posts, b).newer?.page.url).toBe("/blog/c");
    expect(adjacentPosts(posts, b).older?.page.url).toBe("/blog/a");
    expect(adjacentPosts(posts, c).newer).toBeUndefined();
    expect(adjacentPosts(posts, c).older?.page.url).toBe("/blog/b");
    expect(adjacentPosts(posts, docs)).toEqual({});
  });
});

describe("tag page", () => {
  const TagPage = createBlogTagPage<Shape>();
  const render = (tag: string) => appContext.run(ctx, () => withBlog(async () => TagPage({ tag })));

  it("responds 404 for tags without posts", async () => {
    await expect(render("missing")).rejects.toThrow("not found");
    await expect(render("hello-world")).resolves.toBeDefined();
  });
});
