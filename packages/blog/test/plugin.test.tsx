import { describe, expect, it, vi } from "vitest";
import type { AppShape, Context, View, ViewRoute } from "@fumapress/core";
import type { Page } from "fumadocs-core/source";
import { prerender } from "react-dom/static";
import type { ReactNode } from "react";
import {
  blogPlugin,
  getBlogPosts,
  type BlogIndexViewProps,
  type BlogPluginOptions,
} from "../src/index";

function page(type: string, path: string, data: Record<string, unknown> = {}): Page {
  const [, lang] = /\.(\w+)\.mdx$/.exec(path) ?? [undefined, "en"];
  const slugs = path.replace(/(\.\w+)?\.mdx$/, "").split("/");
  return {
    type,
    path,
    absolutePath: path,
    slugs,
    url: `/${lang}/${slugs.join("/")}`,
    locale: lang,
    data: { title: path, ...data },
  };
}

const pages = [
  page("docs", "index.mdx"),
  page("blog", "blog/old.mdx", {
    date: "2026-01-01",
    tags: ["News", "Release Notes"],
    authors: ["fuma"],
  }),
  page("blog", "blog/new.mdx", { date: "2026-02-01", tags: ["news"], image: "/cover.png" }),
  page("blog", "blog/new.cn.mdx", { date: "2026-02-01", tags: ["新闻"] }),
  page("news", "news/hello.mdx", { date: "2025-01-01", tags: ["news"] }),
];

/** the site of the hooks: pages with a `date` frontmatter */
function context(blog: ReturnType<typeof blogPlugin>) {
  return {
    languages: ["en", "cn"],
    getLoader: () => ({ getPages: (lang: string) => pages.filter((p) => p.locale === lang) }),
    getCapability: (capability: string) => (capability === "blog" ? blog.api : undefined),
    localizePath: (lang: string, path: string) => `/${lang}${path}`,
    getPageCreatedAt: async (page: Page) => new Date(Reflect.get(page.data, "date")),
    getPageToc: async () => [],
  } as unknown as Context;
}

type Options = Partial<BlogPluginOptions<AppShape, string | undefined>>;

function setup({ source = "blog", ...options }: Options = {}, body?: ReactNode) {
  const plugin = blogPlugin({ source, ...options });
  const ctx = context(plugin);
  const views = async (lang: string) => {
    const out: ViewRoute[] = [];
    await plugin.routes!.call(ctx, {
      createApi() {},
      createView(route) {
        if (route.lang === lang) out.push(route);
      },
    });
    return out;
  };
  return {
    plugin,
    views,
    /** the posts of the index view */
    posts: async (lang: string) => {
      const [index] = await views(lang);
      return ((await render(index)) as View<{ "blog.index": BlogIndexViewProps }>).props.posts;
    },
    /** the page as core renders it, with `body` as its wrapped content */
    view: (page: Page) => plugin.getPageView!.call(ctx, page, body ? { node: body } : undefined),
    ctx,
  };
}

/** a view as the runtime renders it */
function render(route: ViewRoute | undefined, params: Record<string, string> = {}) {
  return route!.view(params, { lang: "en", request: new Request("http://localhost") });
}

async function html(node: ReactNode) {
  const { prelude } = await prerender(node);
  return new Response(prelude).text();
}

describe("blogPlugin", () => {
  it("adds the index, tags and tag views per language", async () => {
    const { views } = setup();
    expect((await views("en")).map(({ path, staticPaths }) => ({ path, staticPaths }))).toEqual([
      { path: "/blog", staticPaths: undefined },
      { path: "/blog/tags", staticPaths: undefined },
      { path: "/blog/tags/[tag]", staticPaths: ["news", "release-notes"] },
    ]);
    expect((await views("cn"))[2]?.staticPaths).toEqual(["新闻"]);
  });

  it("follows `paths`", async () => {
    const custom = setup({ paths: { index: false, tags: "/tags/" } });
    expect((await custom.views("en")).map((route) => route.path)).toEqual([
      "/tags/",
      "/tags/[tag]",
    ]);
    expect(await setup({ paths: { index: false, tags: false } }).views("en")).toEqual([]);
  });

  it("renders the index and tag views with their props", async () => {
    const [index, tags, tag] = await setup().views("en");
    const indexView = (await render(index))!;
    expect(indexView.type).toBe("blog.index");
    expect(indexView.props).toMatchObject({
      tagsUrl: "/en/blog/tags",
      posts: [
        { page: { path: "blog/new.mdx" }, image: "/cover.png", tags: [{ tag: "news", count: 2 }] },
        { page: { path: "blog/old.mdx" }, authors: [{ name: "fuma" }] },
      ],
    });

    expect((await render(tags))?.props).toEqual({
      indexUrl: "/en/blog",
      tags: [
        { tag: "news", count: 2, url: "/en/blog/tags/news" },
        { tag: "Release Notes", count: 1, url: "/en/blog/tags/release-notes" },
      ],
    });

    // the 404 page for unknown tags
    expect(await render(tag, { tag: "missing" })).toBeUndefined();
    const view = (await render(tag, { tag: "news" })) as View<{ "blog.tag": object }>;
    const out = await html(view.node);
    expect(out).toContain("2<!-- --> matching blog posts.");
    expect(out).toContain('href="/en/blog/new"');
    expect(out).toContain('href="/en/blog"');
  });

  it("renders the pages of its sources", async () => {
    const { view } = setup({ authors: { fuma: { name: "Fuma Nama" } } }, <p>Body</p>);
    expect(await view(pages[0]!)).toBeUndefined();
    expect(await view(pages[4]!)).toBeUndefined();

    const post = (await view(pages[1]!))!;
    expect(post.props).toMatchObject({
      post: { authors: [{ name: "Fuma Nama" }] },
      newer: { page: { path: "blog/new.mdx" } },
      older: undefined,
      indexUrl: "/en/blog",
    });
    const out = await html(post.node);
    expect(out).toContain("<p>Body</p>");
    expect(out).toContain("Fuma Nama");
    expect(out).toContain('href="/en/blog/tags/release-notes"');
    expect(out).toContain('href="/en/blog/new"');
    expect(out).not.toContain("Older post");

    // no content source renders bodies here
    await expect(setup().view(pages[1]!)).rejects.toThrow(
      'the blog post "blog/old.mdx" has no body',
    );
  });

  it("reads the options before the frontmatter", async () => {
    const { posts } = setup({
      getTags: (page) => (page.slugs[1] === "old" ? ["Custom"] : undefined),
      getAuthors: () => ["someone"],
    });
    expect(
      (await posts("en")).map(({ page, authors, tags }) => [page.path, authors, tags]),
    ).toEqual([
      [
        "blog/new.mdx",
        [{ name: "someone" }],
        [{ tag: "news", count: 1, url: "/en/blog/tags/news" }],
      ],
      [
        "blog/old.mdx",
        [{ name: "someone" }],
        [{ tag: "Custom", count: 1, url: "/en/blog/tags/custom" }],
      ],
    ]);
  });

  it("owns the pages of several sources", async () => {
    const { posts, view } = setup({ source: ["blog", "news"] }, <p />);
    expect((await posts("en")).map((post) => post.page.path)).toEqual([
      "blog/new.mdx",
      "blog/old.mdx",
      "news/hello.mdx",
    ]);
    expect(await view(pages[4]!)).toMatchObject({ props: { newer: { page: pages[1] } } });
  });

  it("retries a failed `getTags`", async () => {
    const getTags = vi.fn<() => undefined>().mockRejectedValueOnce(new Error("timeout"));
    const { posts } = setup({ getTags, paths: { tags: false } });
    await expect(posts("en")).rejects.toThrow("timeout");
    expect(await posts("en")).toHaveLength(2);
  });

  it("lists the posts for own pages", async () => {
    const { ctx, posts } = setup();
    expect(await getBlogPosts(ctx, { lang: "en" })).toEqual(await posts("en"));
    await expect(
      getBlogPosts({ getCapability: () => undefined } as unknown as Context, { lang: "en" }),
    ).rejects.toThrow("requires blogPlugin()");
  });
});
