import { describe, expect, it } from "vitest";
import { createElement, type FC } from "react";
import { renderToReadableStream } from "react-dom/server.edge";
import type { Page, PageData } from "fumadocs-core/source";
import { appContext, type AppContext, type AppShape } from "@/app/context";
import type { RouteFns } from "@/lib/types";
import { blogPlugin, getBlogPosts, tagSlug, type BlogPluginOptions } from "@/plugins/blog";
import { adjacentPosts, groupTags } from "@/lib/shared/blog";
import { createApp, i18n } from "./fixtures";

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
    const { result: posts } = await withBlog(() => getBlogPosts(ctx));

    expect(adjacentPosts(posts, b).newer?.page.url).toBe("/blog/c");
    expect(adjacentPosts(posts, b).older?.page.url).toBe("/blog/a");
    expect(adjacentPosts(posts, c).newer).toBeUndefined();
    expect(adjacentPosts(posts, c).older?.page.url).toBe("/blog/b");
    expect(adjacentPosts(posts, docs)).toEqual({});
  });
});

/** `docs/basics` is the only post, tagged "React" and "Hello World" in `en`, "React" in `cn` */
async function createBlogApp(options: Parameters<typeof createApp>[0] = {}) {
  const ctx = await createApp(options);
  const tags: Record<string, string[]> = {
    "docs/basics.mdx": ["React", "Hello World"],
    "docs/basics.cn.mdx": ["React"],
  };
  ctx.adapters = [{ "blog:get-tags": (page) => tags[page.path] }];
  return ctx;
}

/** register the plugin's routes, `render()` renders one of them by its route path */
async function blogRoutes(ctx: AppContext, options: BlogPluginOptions = {}) {
  let interceptor!: <R>(next: () => Promise<R>) => Promise<R>;
  const routes = new Map<string, FC<Record<string, unknown>>>();
  const layout: FC = () => createElement("main");

  await blogPlugin({
    isBlog: (page) => page.slugs.join("/") === "docs/basics",
    ...options,
    layouts: { index: layout, tags: layout, tag: layout, ...options.layouts },
  }).createPages!.call(ctx, {
    createInterceptor: (i: typeof interceptor) => {
      interceptor = i;
    },
    createPage: (page: { path: string; component: FC<Record<string, unknown>> }) => {
      routes.set(page.path, page.component);
    },
    createLayout: () => {},
  } as unknown as RouteFns);

  return {
    routes,
    render(path: string, props: Record<string, unknown> = {}) {
      const Route = routes.get(path);
      if (!Route) throw new Error(`missing route ${path}`);

      return appContext.run(ctx, () =>
        interceptor(async () => {
          const stream = await renderToReadableStream(createElement(Route, props));
          await stream.allReady;
          return new Response(stream).text();
        }),
      );
    },
  };
}

describe("blog route links", () => {
  it("adds canonical URLs to the index, tags and tag pages", async () => {
    const ctx = await createBlogApp({ site: { trailingSlash: true } });
    const { render } = await blogRoutes(ctx);

    const index = await render("/(blog)/blog");
    expect(index).toContain('<link rel="canonical" href="https://example.com/blog/"/>');
    expect(index).toContain('<meta property="og:url" content="https://example.com/blog/"/>');
    expect(index).toContain("<main>");
    expect(index).not.toContain("hrefLang");

    expect(await render("/(blog)/blog/tags")).toContain(
      '<link rel="canonical" href="https://example.com/blog/tags/"/>',
    );
    expect(await render("/(blog)/blog/tags/[tag]", { tag: "hello-world" })).toContain(
      '<link rel="canonical" href="https://example.com/blog/tags/hello-world/"/>',
    );
    // percent-encoded on dynamic requests
    expect(await render("/(blog)/blog/tags/[tag]", { tag: "hello%2Dworld" })).toContain(
      '<link rel="canonical" href="https://example.com/blog/tags/hello-world/"/>',
    );
  });

  it("skips tags without posts", async () => {
    const { render } = await blogRoutes(await createBlogApp());
    const html = await render("/(blog)/blog/tags/[tag]", { tag: "missing" });

    expect(html).toContain("<main>");
    expect(html).not.toContain("canonical");
  });

  it("follows configured paths and skips disabled routes", async () => {
    const { routes, render } = await blogRoutes(await createBlogApp(), {
      paths: { index: "/", tags: false },
    });

    expect(Array.from(routes.keys())).toEqual(["/(blog)"]);
    expect(await render("/(blog)")).toContain(
      '<link rel="canonical" href="https://example.com/"/>',
    );
  });

  it("skips canonical without baseUrl", async () => {
    const ctx = await createBlogApp();
    ctx.siteConfig.baseUrl = undefined;
    const html = await (await blogRoutes(ctx)).render("/(blog)/blog");

    expect(html).not.toContain("canonical");
    expect(html).not.toContain("og:url");
  });

  it("links translations of blog routes", async () => {
    const { render } = await blogRoutes(
      await createBlogApp({ i18n, site: { hreflang: { cn: "zh-Hans" } } }),
    );

    const index = await render("/cn/(blog)/blog");
    expect(index).toContain('<link rel="canonical" href="https://example.com/cn/blog"/>');
    expect(index).toContain(
      '<link rel="alternate" hrefLang="en" href="https://example.com/en/blog"/>',
    );
    expect(index).toContain(
      '<link rel="alternate" hrefLang="zh-Hans" href="https://example.com/cn/blog"/>',
    );
    expect(index).toContain(
      '<link rel="alternate" hrefLang="x-default" href="https://example.com/en/blog"/>',
    );

    const react = await render("/cn/(blog)/blog/tags/[tag]", { tag: "react" });
    expect(react).toContain(
      '<link rel="canonical" href="https://example.com/cn/blog/tags/react"/>',
    );
    expect(react).toContain(
      '<link rel="alternate" hrefLang="en" href="https://example.com/en/blog/tags/react"/>',
    );

    // only English posts use it
    const hello = await render("/en/(blog)/blog/tags/[tag]", { tag: "hello-world" });
    expect(hello).toContain(
      '<link rel="canonical" href="https://example.com/en/blog/tags/hello-world"/>',
    );
    expect(hello).not.toContain("hrefLang");
    expect(await render("/cn/(blog)/blog/tags/[tag]", { tag: "hello-world" })).not.toContain(
      "canonical",
    );
  });

  it("drops the hidden locale prefix", async () => {
    const { render } = await blogRoutes(
      await createBlogApp({ i18n: { ...i18n, hideLocale: "default-locale" } }),
    );
    const html = await render("/(default)/(blog)/blog/tags");

    expect(html).toContain('<link rel="canonical" href="https://example.com/blog/tags"/>');
    expect(html).toContain(
      '<link rel="alternate" hrefLang="cn" href="https://example.com/cn/blog/tags"/>',
    );
  });
});
