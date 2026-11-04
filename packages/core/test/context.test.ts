import { existsSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement, isValidElement, lazy, type ReactElement, type ReactNode } from "react";
import { defineI18n, type I18nConfig } from "fumadocs-core/i18n";
import type { _Internal, PageData, VirtualFile } from "fumadocs-core/source";
import { createPressContext, type Context } from "@/context";
import type { Plugin as FrameworkPlugin } from "fumadocs-core/framework/plugin";
import type { AppShape, HeadTag, PageRoute, Plugin, PresetEntry } from "@/plugin";
import {
  createPress,
  renderPage,
  type DefaultPageProps,
  type PressConfig,
  type RenderTarget,
} from "@/press";
import { takumiPlugin } from "@/plugins/takumi";
import { pressContext, testPress, type TestRuntime, type TestSite } from "./harness";

const i18n: I18nConfig = { languages: ["en", "cn"], defaultLanguage: "en" };

function page(file: string, data?: PageData & { full?: unknown }): VirtualFile {
  return {
    type: "page",
    path: file,
    absolutePath: `/repo/content/${file}`,
    data: { title: file, description: `About ${file}`, ...data },
  };
}

/** `docs/basics` is translated, `docs/only-en` falls back to English in `cn`, `docs/shared` belongs to every language */
const files = [
  page("index.mdx"),
  page("docs/basics.mdx"),
  page("docs/basics.cn.mdx"),
  page("docs/only-en.mdx"),
  page("docs/shared.$.mdx"),
];

function createSite(config: Partial<TestSite> = {}, runtime: TestRuntime = {}) {
  return pressContext(
    {
      content: { files },
      ...config,
      site: { baseUrl: "https://example.com", ...config.site },
    },
    runtime,
  );
}

async function getPage(ctx: Context, slugs: string[], lang?: string) {
  const page = (await ctx.getLoader()).getPage(slugs, lang);
  if (!page) throw new Error(`missing page ${slugs.join("/")} (${lang})`);
  return page;
}

function GET() {
  return new Response("ok");
}

/** an own page of the runtime at `path` */
function ownRoute(path: string, lang?: string): PageRoute {
  return {
    path,
    lang,
    render: "static",
    pages: [{ path, translations: [], params: {} }],
    options: {},
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createPressContext", () => {
  it("runs init, configureLoader and configure in order, on a frozen context", async () => {
    const calls: string[] = [];
    const signal = new AbortController().signal;
    const ctx = await createSite(
      {
        i18n,
        plugins: [
          {
            init() {
              calls.push("a:init");
              expect(() => this.getLoader()).toThrow("the content loader is created after");
              expect(() => Object.assign(this, { mode: "static" })).toThrow();
              expect(this.signal).toBe(signal);
            },
            configureLoader(options) {
              calls.push("a:configureLoader");
              expect(options).toMatchObject({ baseUrl: "/", i18n });
              return { url: (slugs, locale) => `/${locale}/v2/${slugs.join("/")}` };
            },
            configure() {
              calls.push("a:configure");
            },
          },
          {
            init: () => void calls.push("b:init"),
            configure: () => void calls.push("b:configure"),
          },
        ],
      },
      { signal },
    );

    expect(calls).toEqual(["a:init", "b:init", "a:configureLoader", "a:configure", "b:configure"]);
    expect((await getPage(ctx, ["docs", "basics"], "cn")).url).toBe("/cn/v2/docs/basics");
    expect(
      Object.isFrozen(ctx) && Object.isFrozen(ctx.siteConfig) && Object.isFrozen(ctx.plugins),
    ).toBe(true);
  });

  it('rejects `hideLocale: "always"`', async () => {
    await expect(createSite({ i18n: { ...i18n, hideLocale: "always" } })).rejects.toThrow(
      '`hideLocale: "always"` is not supported',
    );
  });

  it("extends the translations with the keys of plugins and runtime defaults", async () => {
    const translations = defineI18n(i18n).translations();
    const ctx = await createSite(
      { i18n, ui: { translations }, plugins: [{ translations: { keys: ["Copy"] } }] },
      { defaults: [{ translations: { keys: ["Search"] } }] },
    );
    translations.add({ en: { Copy: "Copy", Search: "Search", Unknown: "Unknown" } });

    expect(ctx.translationsConfig).toBe(translations);
    expect(ctx.i18nConfig).toBe(i18n);
    expect(translations.get("en")).toEqual({ Copy: "Copy", Search: "Search" });
    expect((await createSite({ i18n })).translationsConfig).toBeUndefined();
  });

  it("revalidates dynamic sources", async () => {
    let list = [page("index.mdx")];
    const ctx = await createSite({ content: { files: () => list } });
    const always = await createSite({
      content: { files: () => list },
      loaderOptions: { alwaysRevalidate: true },
    });
    expect((await ctx.getLoader()).getPages()).toHaveLength(1);
    expect((await always.getLoader()).getPages()).toHaveLength(1);
    list = [page("index.mdx"), page("other.mdx")];

    expect((await ctx.getLoader()).getPages()).toHaveLength(1);
    await ctx.revalidateLoader();
    expect((await ctx.getLoader()).getPages()).toHaveLength(2);
    expect((await always.getLoader()).getPages()).toHaveLength(2);
  });

  it("gives plugins the runtime's check for client references", async () => {
    const action = () => {};
    const ctx = await createSite({}, { isClientReference: (value) => value === action });

    expect(ctx.isClientReference(action)).toBe(true);
    expect(ctx.isClientReference(() => {})).toBe(false);
  });

  it("hands the runtime the plugins with their hooks", async () => {
    const routes = () => {};
    const ctx = await createSite({ plugins: [{ name: "a", routes }] });

    expect(ctx.plugins[0]?.routes).toBe(routes);
  });

  it("names `enforce` as an unknown plugin key: plugins run in layer order", () => {
    const press = createPress<_Internal.AnyInput, undefined, AppShape, {}>({ files });
    // @ts-expect-error -- "unknown plugin keys": "enforce"
    expect(press.plugins({ name: "late", enforce: "post" })).toHaveProperty("config");
  });
});

describe("layers", () => {
  const entry = (provides: string): PresetEntry<Plugin<AppShape, any>> => ({
    provides,
    load: vi.fn(() => ({ name: `core:${provides}`, provides: [provides] })),
  });

  it("orders your plugins, the preset, then the runtime's defaults", async () => {
    const preset = [entry("a"), entry("b")];
    const ctx = await createSite(
      { preset, plugins: [{ name: "one" }, [{ name: "two" }, false, null], undefined] },
      { defaults: [{ name: "mdx" }] },
    );

    expect(ctx.plugins.map((plugin) => plugin.name)).toEqual([
      "one",
      "two",
      "core:a",
      "core:b",
      "mdx",
    ]);
  });

  it("puts a listed plugin providing an entry's capability in the entry's place", async () => {
    const preset = [entry("a"), entry("b"), entry("c")];
    const ctx = await createSite({
      preset,
      plugins: [{ name: "my-b", provides: ["b"] }, { name: "one" }],
    });

    expect(ctx.plugins.map((plugin) => plugin.name)).toEqual(["one", "core:a", "my-b", "core:c"]);
    expect(preset[1]!.load).not.toHaveBeenCalled();
  });

  it("uses the runtime's preset without `preset`, none with `[]`", async () => {
    const preset = vi.fn(() => [entry("image")]);
    expect((await createSite({ preset: undefined }, { preset })).plugins).toHaveLength(1);
    expect((await createSite({}, { preset })).plugins).toHaveLength(0);
  });

  it("gives a capability one provider, naming both", async () => {
    await expect(
      createSite({
        plugins: [
          { name: "x", provides: ["search"] },
          { name: "y", provides: ["search"] },
        ],
      }),
    ).rejects.toThrow('"x" and "y" both provide "search": a capability has one provider.');
  });
});

describe("page hooks", () => {
  it("resolve to the first answer, an earlier layer winning", async () => {
    const ctx = await createSite(
      { plugins: [{ getPageText: (page) => (page.url === "/" ? undefined : "plugin") }] },
      { defaults: [{ getPageText: () => "default" }] },
    );

    await expect(ctx.getPageText(await getPage(ctx, ["docs", "basics"]))).resolves.toBe("plugin");
    await expect(ctx.getPageText(await getPage(ctx, []))).resolves.toBe("default");
  });

  it("reject two answers for one page in one layer, naming both", async () => {
    const ctx = await createSite({
      plugins: [
        { name: "blog", getPageView: () => ({ props: {}, node: null }) },
        { name: "notes", getPageView: () => ({ props: {}, node: null }) },
      ],
    });

    await expect(ctx.getPageView(await getPage(ctx, []), undefined)).rejects.toThrow(
      '"blog" and "notes" both answer `getPageView` for "/": a page has one renderer.',
    );
  });
});

describe("getPageData", () => {
  it("fills the data from the page and plugins", async () => {
    const ctx = await createSite({
      i18n,
      site: { git: { user: "fuma-nama", repo: "fumapress", branch: "dev", rootDir: "/repo" } },
      plugins: [{ getPageToc: () => [{ title: "Intro", url: "#intro", depth: 2 }] }],
    });

    await expect(ctx.getPageData(await getPage(ctx, ["docs", "basics"], "cn"))).resolves.toEqual({
      title: "docs/basics.cn.mdx",
      description: "About docs/basics.cn.mdx",
      url: "/cn/docs/basics",
      path: "docs/basics.cn.mdx",
      locale: "cn",
      toc: [{ title: "Intro", url: "#intro", depth: 2 }],
      full: undefined,
      lastModified: undefined,
      githubUrl: "https://github.com/fuma-nama/fumapress/blob/dev/content/docs/basics.cn.mdx",
    });
  });

  it("gives every `transformPage` the base data and merges the fields each one changes", async () => {
    const seen: string[] = [];
    const ctx = await createSite({
      plugins: [
        {
          transformPage(data) {
            seen.push(data.title);
            expect(Object.isFrozen(data)).toBe(true);
            return { ...data, title: "A" };
          },
        },
        {
          transformPage(data) {
            seen.push(data.title);
            return { ...data, full: true };
          },
        },
      ],
    });

    await expect(ctx.getPageData(await getPage(ctx, []))).resolves.toMatchObject({
      title: "A",
      full: true,
    });
    expect(seen).toEqual(["index.mdx", "index.mdx"]);
  });

  it("gives a field one `transformPage`, naming both", async () => {
    const ctx = await createSite({
      plugins: [
        { name: "acme:md", transformPage: (data) => ({ ...data, markdownUrl: "/a.md" }) },
        { name: "core:llms.txt", transformPage: (data) => ({ ...data, markdownUrl: "/b.md" }) },
      ],
    });

    await expect(ctx.getPageData(await getPage(ctx, []))).rejects.toThrow(
      '"acme:md" and "core:llms.txt" both set `markdownUrl` of the page "/"',
    );
  });
});

describe("configureLoader", () => {
  it("collects loader plugins in layer order, after the site's", async () => {
    const ran: string[] = [];
    const plugin = (name: string) => ({ name, transformStorage: () => void ran.push(name) });
    const own = plugin("own");
    const given: unknown[] = [];
    const ctx = await createSite({
      loaderOptions: { plugins: [own] },
      plugins: [
        {
          configureLoader(options) {
            given.push(...(options.plugins ?? []));
            return { plugins: [plugin("a")] };
          },
        },
        { configureLoader: () => ({ plugins: [plugin("b")] }) },
      ],
    });
    await ctx.getLoader();

    expect(given).toEqual([own]);
    expect(ran).toEqual(["own", "a", "b"]);
  });

  it("gives another option one writer, the site's winning", async () => {
    const url = () => "/x";
    const write = (name: string) => ({ name, configureLoader: () => ({ url }) });

    await expect(createSite({ plugins: [write("a"), write("b")] })).rejects.toThrow(
      '"a" and "b" both set the loader option `url`',
    );
    const ctx = await createSite({
      loaderOptions: { url: () => "/site" },
      plugins: [write("a"), write("b")],
    });
    expect((await getPage(ctx, ["docs", "basics"])).url).toBe("/site");
  });
});

describe("getHead", () => {
  it("keys tags: yours over plugins', theirs over core's, a page's over every page's", async () => {
    const ctx = await createSite({
      head: ({ page }): HeadTag[] =>
        page
          ? [{ tag: "meta", attrs: { name: "description", content: "site" } }]
          : [
              { tag: "meta", attrs: { property: "og:image", content: "/default.png" } },
              { tag: "link", attrs: { rel: "icon", href: "/favicon.ico" } },
            ],
      plugins: [
        {
          head: ({ page }): HeadTag[] => [
            { tag: "title", children: "plugin" },
            { tag: "link", attrs: { rel: "icon", href: "/favicon.ico" } },
            ...(page
              ? [{ tag: "meta" as const, attrs: { property: "og:image", content: "/page.png" } }]
              : []),
          ],
        },
        { head: () => [{ tag: "title", children: "second" }] },
      ],
    });
    const tags = await ctx.getHead({ page: await getPage(ctx, ["docs", "basics"]) });

    expect(tags.filter((tag) => tag.tag === "title")).toEqual([
      { tag: "title", children: "plugin" },
    ]);
    expect(tags).toContainEqual({ tag: "meta", attrs: { name: "description", content: "site" } });
    expect(tags).toContainEqual({
      tag: "meta",
      attrs: { property: "og:image", content: "/page.png" },
    });
    expect(tags.filter((tag) => tag.attrs?.rel === "icon")).toHaveLength(1);
    expect(tags).toContainEqual({
      tag: "meta",
      attrs: { property: "og:title", content: "docs/basics.mdx" },
    });
    await expect(ctx.getHead({})).resolves.toEqual([
      { tag: "meta", attrs: { property: "og:image", content: "/default.png" } },
      { tag: "link", attrs: { rel: "icon", href: "/favicon.ico" } },
      { tag: "title", children: "plugin" },
    ]);
  });

  it("keys the title and description of views over the ones of every page", async () => {
    const ctx = await createSite({
      head: [
        { tag: "title", children: "Site" },
        { tag: "meta", attrs: { name: "description", content: "A site" } },
      ],
    });
    const route = ownRoute("/blog");
    const head = await ctx.getHead({
      route,
      path: "/blog",
      view: { type: "blog.index", props: {}, node: null, title: "Blog", description: "Posts" },
    });

    expect(head.filter((tag) => tag.tag === "title")).toEqual([{ tag: "title", children: "Blog" }]);
    expect(head.filter((tag) => tag.attrs?.name === "description")).toEqual([
      { tag: "meta", attrs: { name: "description", content: "Posts" } },
    ]);
  });

  it("links the translations of framework pages", async () => {
    const ctx = await createSite({ i18n });
    const translations = [
      { lang: "en", path: "/en/about" },
      { lang: "cn", path: "/cn/about" },
    ];
    const route: PageRoute = {
      path: "/cn/about",
      lang: "cn",
      render: "static",
      options: {},
      pages: [{ path: "/cn/about", translations, params: {} }],
    };

    await expect(ctx.getHead({ route, path: "/cn/about" })).resolves.toEqual([
      { tag: "link", attrs: { rel: "canonical", href: "https://example.com/cn/about" } },
      { tag: "meta", attrs: { property: "og:url", content: "https://example.com/cn/about" } },
      {
        tag: "link",
        attrs: { rel: "alternate", hreflang: "en", href: "https://example.com/en/about" },
      },
      {
        tag: "link",
        attrs: { rel: "alternate", hreflang: "cn", href: "https://example.com/cn/about" },
      },
      {
        tag: "link",
        attrs: { rel: "alternate", hreflang: "x-default", href: "https://example.com/en/about" },
      },
    ]);
  });
});

describe("getHead of content pages", () => {
  it("returns the defaults of content pages", async () => {
    const ctx = await createSite({ i18n, site: { hreflang: { cn: "zh-Hans" } } });

    await expect(
      ctx.getHead({ page: await getPage(ctx, ["docs", "basics"], "en") }),
    ).resolves.toEqual([
      { tag: "title", children: "docs/basics.mdx" },
      { tag: "meta", attrs: { name: "description", content: "About docs/basics.mdx" } },
      { tag: "meta", attrs: { property: "og:title", content: "docs/basics.mdx" } },
      { tag: "meta", attrs: { property: "og:description", content: "About docs/basics.mdx" } },
      { tag: "meta", attrs: { property: "og:site_name", content: "Fumapress" } },
      { tag: "link", attrs: { rel: "canonical", href: "https://example.com/en/docs/basics" } },
      { tag: "meta", attrs: { property: "og:url", content: "https://example.com/en/docs/basics" } },
      {
        tag: "link",
        attrs: { rel: "alternate", hreflang: "en", href: "https://example.com/en/docs/basics" },
      },
      {
        tag: "link",
        attrs: {
          rel: "alternate",
          hreflang: "zh-Hans",
          href: "https://example.com/cn/docs/basics",
        },
      },
      {
        tag: "link",
        attrs: {
          rel: "alternate",
          hreflang: "x-default",
          href: "https://example.com/en/docs/basics",
        },
      },
    ]);
  });

  it("marks fallback pages noindex, with the canonical of their origin", async () => {
    const ctx = await createSite({ i18n });

    for (const slugs of [
      ["docs", "only-en"],
      ["docs", "shared"],
    ]) {
      const tags = await ctx.getHead({ page: await getPage(ctx, slugs, "cn") });
      expect(tags).toContainEqual({ tag: "meta", attrs: { name: "robots", content: "noindex" } });
      expect(tags).toContainEqual({
        tag: "link",
        attrs: { rel: "canonical", href: `https://example.com/en/${slugs.join("/")}` },
      });
      expect(tags.some((tag) => tag.attrs?.rel === "alternate")).toBe(false);
    }

    const translated = await ctx.getHead({ page: await getPage(ctx, ["docs", "basics"], "cn") });
    expect(translated).not.toContainEqual({
      tag: "meta",
      attrs: { name: "robots", content: "noindex" },
    });
  });

  it("marks fallback pages of sources without an absolute path", async () => {
    const relative: VirtualFile[] = [];
    for (const file of files) relative.push({ ...file, absolutePath: undefined });
    const ctx = await createSite({ i18n, content: { files: relative } });
    const fallback = await ctx.getHead({ page: await getPage(ctx, ["docs", "only-en"], "cn") });
    const translated = await ctx.getHead({ page: await getPage(ctx, ["docs", "basics"], "cn") });
    const noindex = { tag: "meta", attrs: { name: "robots", content: "noindex" } };

    expect(fallback).toContainEqual(noindex);
    expect(fallback).toContainEqual({
      tag: "link",
      attrs: { rel: "canonical", href: "https://example.com/en/docs/only-en" },
    });
    expect(translated).not.toContainEqual(noindex);
    expect(translated).toContainEqual({
      tag: "link",
      attrs: { rel: "canonical", href: "https://example.com/cn/docs/basics" },
    });
  });

  it("skips canonical without `site.baseUrl`", async () => {
    const ctx = await createSite({ site: { baseUrl: undefined } });
    const tags = await ctx.getHead({ page: await getPage(ctx, ["docs", "basics"]) });

    expect(
      tags.some((tag) => tag.attrs?.rel === "canonical" || tag.attrs?.property === "og:url"),
    ).toBe(false);
  });
});

describe("getSlots", () => {
  it("sorts by order, then by layer and list order", async () => {
    const item = (id: string, order?: number) => ({
      slot: "layout.wrapper" as const,
      component: () => null,
      props: { id },
      order,
    });
    const ctx = await createSite(
      {
        plugins: [
          { slots: () => [item("a", 1), item("b")] },
          { slots: () => [item("c"), item("provider", -1)] },
        ],
      },
      { defaults: [{ slots: () => [item("d")] }] },
    );
    const items = (await ctx.getSlots({}))["layout.wrapper"] ?? [];

    expect(items.map((item) => item.props?.id)).toEqual(["provider", "b", "c", "d", "a"]);
  });

  it("gives a named item one writer, naming both", async () => {
    const action = (name: string) => ({
      name,
      slots: () => [{ slot: "actions" as const, name: "share", component: () => null }],
    });
    const ctx = await createSite({ plugins: [action("a"), action("b")] });

    await expect(ctx.getSlots({ page: await getPage(ctx, []) })).rejects.toThrow(
      '"a" and "b" both add the "actions" item "share"',
    );
  });
});

describe("getApiRoutes", () => {
  it("rejects routes created after their hook returned", async () => {
    let late: (() => void) | undefined;
    const ctx = await createSite({
      plugins: [
        {
          name: "late",
          routes({ createApi }) {
            late = () => createApi({ path: "/late", GET });
          },
        },
      ],
    });

    await ctx.getApiRoutes();
    expect(late).toThrow('"late" creates the route "/late" after its hook returned');
  });

  it("renders on request by default, static routes follow the mode", async () => {
    const config: Partial<TestSite> = {
      plugins: [
        {
          routes({ createApi }) {
            createApi({ path: "/a", GET, render: "static" });
            createApi({ path: "/b", GET });
          },
        },
      ],
    };
    const renders = async (mode?: TestSite["mode"]) =>
      (await (await createSite({ ...config, mode })).getApiRoutes()).map((route) => route.render);

    await expect(renders()).resolves.toEqual(["static", "dynamic"]);
    await expect(renders("dynamic")).resolves.toEqual(["dynamic", "dynamic"]);
    // the site turns it off in the options of the plugin, a plugin that can degrade reads `this.mode`
    await expect(renders("static")).rejects.toThrow(
      'the route "/b" of an unnamed plugin renders on request, which `mode: "static"` can\'t serve',
    );
  });

  it("rejects static routes with handlers other than GET", async () => {
    const post = await createSite({
      plugins: [
        {
          routes: ({ createApi }) => createApi({ path: "/api", render: "static", GET, POST: GET }),
        },
      ],
    });
    const all = await createSite({
      plugins: [
        { routes: ({ createApi }) => createApi({ path: "/api", render: "static", ALL: GET }) },
      ],
    });

    await expect(post.getApiRoutes()).rejects.toThrow(
      'the static route "/api" is generated from its GET handler, its POST handler needs',
    );
    await expect(all.getApiRoutes()).rejects.toThrow("its ALL handler needs");
  });

  it("rejects static routes with params but no `staticPaths`", async () => {
    const missing = await createSite({
      plugins: [
        { routes: ({ createApi }) => createApi({ path: "/og/[...slugs]", render: "static", GET }) },
      ],
    });
    const listed = await createSite({
      plugins: [
        {
          routes: ({ createApi }) =>
            createApi({ path: "/og/[...slugs]", render: "static", GET, staticPaths: [["a"]] }),
        },
      ],
    });

    await expect(missing.getApiRoutes()).rejects.toThrow(
      'the static route "/og/[...slugs]" has params',
    );
    await expect(listed.getApiRoutes()).resolves.toHaveLength(1);
  });

  it("gives a path one route, naming both owners", async () => {
    const routes = (...items: { name: string; POST?: typeof GET; GET?: typeof GET }[]) =>
      createSite({
        mode: "dynamic",
        plugins: items.map(({ name, ...item }) => ({
          name,
          routes: ({ createApi }) => createApi({ path: "/api", ...item }),
        })),
      });

    await expect(
      (await routes({ name: "a", GET }, { name: "b", POST: GET })).getApiRoutes(),
    ).rejects.toThrow('"a" and "b" both take the path "/api": a path has one route.');
    await expect(
      (
        await createSite({
          plugins: [
            { name: "md", routes: ({ createApi }) => createApi({ path: "/docs/basics", GET }) },
          ],
        })
      ).getApiRoutes(),
    ).rejects.toThrow('the content page "/docs/basics" and "md" both take the path "/docs/basics"');
  });

  it("gives a path one route whatever the names of its owners", async () => {
    const named = await createSite({
      plugins: [
        { name: "x", routes: ({ createApi }) => createApi({ path: "/a.txt", GET }) },
        { name: "x", routes: ({ createApi }) => createApi({ path: "/a.txt", GET }) },
      ],
    });
    const unnamed = await createSite({
      plugins: [
        { routes: ({ createApi }) => createApi({ path: "/a.txt", GET }) },
        { routes: ({ createApi }) => createApi({ path: "/a.txt", GET }) },
      ],
    });

    await expect(named.getApiRoutes()).rejects.toThrow('"x" and "x" both take the path "/a.txt"');
    await expect(unnamed.getApiRoutes()).rejects.toThrow(
      "an unnamed plugin and an unnamed plugin both take the path",
    );
  });

  it("leaves the pages of a page pattern to static routes, which serve their listed paths only", async () => {
    const catchAll = (path: string, lang?: string): PageRoute => ({
      path,
      lang,
      render: "static",
      pages: [],
      options: {},
    });
    const plain = await createSite(
      { plugins: [takumiPlugin()] },
      { routes: [{ route: catchAll("/[...slug]") }] },
    );
    const localized = await createSite(
      { i18n, plugins: [takumiPlugin()] },
      {
        routes: [
          { route: catchAll("/en/[...slug]", "en") },
          { route: catchAll("/cn/[...slug]", "cn") },
        ],
      },
    );
    const onRequest = await createSite(
      {
        mode: "dynamic",
        plugins: [
          { name: "x", routes: ({ createApi }) => createApi({ path: "/[...slugs]", GET }) },
        ],
      },
      { routes: [{ route: catchAll("/[...slug]") }] },
    );

    expect((await plain.getApiRoutes()).map((route) => route.path)).toEqual(["/[...slugs]"]);
    expect((await localized.getApiRoutes()).map((route) => route.path)).toEqual([
      "/en/[...slugs]",
      "/cn/[...slugs]",
    ]);
    await expect(onRequest.getApiRoutes()).rejects.toThrow(
      'your own page and "x" both take the path "/[...slugs]"',
    );
  });

  it("sorts routes by specificity", async () => {
    const ctx = await createSite({
      mode: "dynamic",
      plugins: [
        {
          routes({ createApi }) {
            createApi({ path: "/api/[...rest]", GET });
            createApi({ path: "/api/[id]", GET });
            createApi({ path: "/api/list", GET });
          },
        },
      ],
    });
    expect((await ctx.getApiRoutes()).map((route) => route.path)).toEqual([
      "/api/list",
      "/api/[id]",
      "/api/[...rest]",
    ]);
  });
});

describe("views", () => {
  const view = (path: string, type = "x.view") => ({
    path,
    view: () => ({ type, props: { path }, node: path }),
  });

  it("are created once per language, prefixed and linked by `path`", async () => {
    const langs: (string | undefined)[] = [];
    const ctx = await createSite({
      i18n,
      plugins: [
        {
          name: "x",
          routes: ({ createView }) =>
            createView({
              path: "/blog",
              view(_, { lang }) {
                langs.push(lang);
                return undefined;
              },
            }),
        },
      ],
    });
    const routes = await ctx.getRoutes();
    for (const { view, route } of await ctx.getViewRoutes()) {
      if (view.render !== "dynamic") await view.view({}, { lang: route.lang });
    }

    expect(langs).toEqual(["en", "cn"]);
    expect((await ctx.getViewRoutes()).map(({ route, view }) => [route.lang, view.path])).toEqual([
      ["en", "/blog"],
      ["cn", "/blog"],
    ]);
    expect(routes.map((route) => route.path)).toEqual(["/en/blog", "/cn/blog"]);
    expect(routes[0]!.pages[0]!.translations).toEqual([
      { lang: "en", path: "/en/blog" },
      { lang: "cn", path: "/cn/blog" },
    ]);
  });

  it("give way to your own pages", async () => {
    const ctx = await createSite(
      {
        plugins: [
          {
            name: "x",
            routes({ createView }) {
              createView(view("/about"));
              createView(view("/blog"));
            },
          },
        ],
      },
      { routes: [{ route: ownRoute("/about") }] },
    );

    expect((await ctx.getViewRoutes()).map(({ route }) => route.path)).toEqual(["/blog"]);
    expect((await ctx.getRoutes()).map((route) => route.path)).toEqual(["/about", "/blog"]);
  });

  it("give one of their pages to your own page there, keeping the others", async () => {
    const tags = { ...view("/tags/[tag]"), staticPaths: ["a", "b"] };
    const ctx = await createSite(
      { plugins: [{ name: "tags", routes: ({ createView }) => createView(tags) }] },
      { routes: [{ route: ownRoute("/tags/a") }] },
    );
    const every = await createSite(
      {
        plugins: [
          { name: "tags", routes: ({ createView }) => createView({ ...tags, staticPaths: ["a"] }) },
        ],
      },
      { routes: [{ route: ownRoute("/tags/a") }] },
    );
    const [entry] = await ctx.getViewRoutes();

    expect(entry?.route.pages.map((page) => page.path)).toEqual(["/tags/b"]);
    // runtimes register the view with its remaining pages
    expect(entry?.view.staticPaths).toEqual([["b"]]);
    await expect(every.getViewRoutes()).resolves.toEqual([]);
  });

  it("give a path one route, also for one plugin or plugins without names", async () => {
    const unnamed = await createSite({
      plugins: [
        { routes: ({ createView }) => createView(view("/v")) },
        { routes: ({ createView }) => createView(view("/v")) },
      ],
    });
    const plugin: Plugin<AppShape, any> = {
      name: "acme",
      routes: ({ createView }) => createView(view("/showcase")),
    };
    const twice = await createSite(
      { plugins: [plugin] },
      { routes: [{ route: ownRoute("/showcase"), plugin }] },
    );

    await expect(unnamed.getViewRoutes()).rejects.toThrow(
      'an unnamed plugin and an unnamed plugin both take the path "/v"',
    );
    await expect(twice.getViewRoutes()).rejects.toThrow(
      '"acme" and "acme" both take the path "/showcase"',
    );
  });

  it("give a path one route, naming both", async () => {
    const twice = await createSite({
      plugins: [
        { name: "mintlify", routes: ({ createView }) => createView(view("/404")) },
        { name: "site:404", routes: ({ createView }) => createView(view("/404")) },
      ],
    });
    const content = await createSite({
      plugins: [{ name: "print", routes: ({ createView }) => createView(view("/docs/basics")) }],
    });

    await expect(twice.getViewRoutes()).rejects.toThrow(
      '"mintlify" and "site:404" both take the path "/404"',
    );
    await expect(content.getViewRoutes()).rejects.toThrow(
      'the content page "/docs/basics" and "print" both take the path "/docs/basics"',
    );
  });

  it("reject rendering on request in static mode, naming the plugin", async () => {
    const ctx = await createSite({
      mode: "static",
      plugins: [
        {
          name: "status",
          routes: ({ createView }) =>
            createView({ path: "/status", render: "dynamic", view: () => undefined }),
        },
      ],
    });

    await expect(ctx.getViewRoutes()).rejects.toThrow(
      'the route "/status" of "status" renders on request',
    );
  });

  it("are listed with their page routes, the ones of `getRoutes()`", async () => {
    const ctx = await createSite({
      plugins: [{ name: "x", routes: ({ createView }) => createView(view("/blog")) }],
    });
    const [entry] = await ctx.getViewRoutes();

    expect(entry?.view.path).toBe("/blog");
    expect(await ctx.getRoutes()).toContain(entry?.route);
  });

  it("can't read the routes while plugins create them", async () => {
    const ctx = await createSite({
      plugins: [
        {
          name: "eager",
          async routes() {
            await this.getRoutes();
          },
        },
      ],
    });

    await expect(ctx.getRoutes()).rejects.toThrow(
      '"eager" reads the routes while plugins create them',
    );
  });

  it("can't read the routes through the base options while plugins create them", async () => {
    // no home page: the home is looked up in the routes
    const ctx = await pressContext({
      content: { files: [page("docs/basics.mdx")] },
      plugins: [
        {
          name: "nav",
          async routes() {
            await this.getBaseOptions({ lang: undefined });
          },
        },
      ],
    });

    await expect(ctx.getViewRoutes()).rejects.toThrow(
      '"nav" reads the routes while plugins create them',
    );
  });
});

describe("runtime routes", () => {
  const view = (path: string) => ({ path, view: () => ({ type: "x", props: {}, node: path }) });

  it("are read once the runtime sets them, a new list replaces them", async () => {
    const ctx = await createPressContext(testPress({ content: { files } }), {
      base: "/",
      defaults: [],
      signal: new AbortController().signal,
      isClientReference: () => false,
    });

    await expect(ctx.getRoutes()).rejects.toThrow("the routes are read before they are created");
    ctx.setRuntimeRoutes([{ route: ownRoute("/a") }]);
    expect((await ctx.getRoutes()).map((route) => route.path)).toEqual(["/a"]);
    // a rerun of the runtime's routing
    ctx.setRuntimeRoutes([{ route: ownRoute("/b") }]);
    expect((await ctx.getRoutes()).map((route) => route.path)).toEqual(["/b"]);
  });

  it("can't be read during setup", async () => {
    await expect(
      createSite({
        plugins: [
          {
            async configure() {
              await this.getRoutes();
            },
          },
        ],
      }),
    ).rejects.toThrow("the routes are read before they are created");
  });

  it("of runtime hooks belong to their plugin: a view on their path is an error naming both", async () => {
    const ctx = await createSite(
      { plugins: [{ name: "x", routes: ({ createView }) => createView(view("/showcase")) }] },
      { routes: [{ route: ownRoute("/showcase"), plugin: { name: "acme" } }] },
    );

    await expect(ctx.getViewRoutes()).rejects.toThrow(
      '"acme" and "x" both take the path "/showcase"',
    );
  });

  it("of your own win over the pages of runtime hooks", async () => {
    const ctx = await createSite(
      {},
      {
        routes: [
          { route: ownRoute("/a") },
          { route: ownRoute("/a"), plugin: { name: "acme" } },
          { route: ownRoute("/b"), plugin: { name: "acme" } },
        ],
      },
    );

    expect((await ctx.getRoutes()).map((route) => route.path)).toEqual(["/a", "/b"]);
  });

  it("of your own and API routes take a path once, naming both", async () => {
    const ctx = await createSite(
      { plugins: [{ name: "x", routes: ({ createApi }) => createApi({ path: "/about", GET }) }] },
      { routes: [{ route: ownRoute("/about") }] },
    );

    await expect(ctx.getApiRoutes()).rejects.toThrow(
      'your own page and "x" both take the path "/about"',
    );
  });
});

describe("deriveRoutes", () => {
  it("derives routes from the final page routes of each language", async () => {
    const seen: string[] = [];
    const ctx = await createSite(
      {
        i18n,
        plugins: [
          {
            name: "blog",
            routes({ createView }) {
              for (const lang of this.languages)
                createView({
                  lang,
                  path: "/blog",
                  view: () => ({ type: "blog", props: {}, node: lang }),
                });
            },
          },
          {
            name: "print",
            deriveRoutes({ createApi, createView }, { lang, routes }) {
              seen.push(`${lang}: ${routes.map((route) => route.path).join(", ")}`);
              for (const route of routes)
                createView({
                  lang,
                  path: `${route.path.replace(`/${lang}`, "")}/print`,
                  view: () => undefined,
                });
              createApi({ path: `/${lang}/api/routes.json`, GET });
            },
          },
          {
            name: "late",
            deriveRoutes: (_, { routes }) => void seen.push(`late: ${routes.length}`),
          },
        ],
      },
      // an own page without a language belongs to the default one
      { routes: [{ route: ownRoute("/") }, { route: ownRoute("/cn/about", "cn") }] },
    );

    expect((await ctx.getRoutes()).map((route) => route.path)).toEqual([
      "/",
      "/cn/about",
      "/en/blog",
      "/cn/blog",
      "/en/print",
      "/en/blog/print",
      "/cn/about/print",
      "/cn/blog/print",
    ]);
    expect(seen).toEqual(["en: /, /en/blog", "cn: /cn/about, /cn/blog", "late: 2", "late: 2"]);
    expect((await ctx.getApiRoutes()).map((route) => route.path)).toEqual([
      "/en/api/routes.json",
      "/cn/api/routes.json",
    ]);
  });

  it("serve the page routes they derive from to pages they render, like the home of base options", async () => {
    let site: Context | undefined;
    const rendered: unknown[] = [];
    const ctx = await pressContext(
      {
        content: { files: [page("docs/basics.mdx")] },
        plugins: [
          {
            name: "md",
            // like the Markdown of your own pages, which read the site outside of plugin hooks
            async deriveRoutes() {
              rendered.push(
                await site!.getBaseOptions({ lang: undefined }),
                (await site!.getRoutes()).map((route) => route.path),
              );
            },
          },
        ],
      },
      { routes: [{ route: ownRoute("/about") }] },
    );
    site = ctx;

    await ctx.getApiRoutes();
    expect(rendered).toEqual([{ nav: { title: "Fumapress", url: "/docs/basics" } }, ["/about"]]);
  });

  it("rejects a derived view on a content page, naming both", async () => {
    const ctx = await createSite({
      plugins: [
        {
          name: "print",
          deriveRoutes: ({ createView }) =>
            createView({ path: "/docs/basics", view: () => undefined }),
        },
      ],
    });

    await expect(ctx.getViewRoutes()).rejects.toThrow(
      'the content page "/docs/basics" and "print" both take',
    );
  });
});

describe("handleRequest", () => {
  it("runs middleware in layer order, the first plugin outermost", async () => {
    const calls: string[] = [];
    const ctx = await createSite(
      {
        plugins: [
          {
            async middleware(_request, next) {
              calls.push("a");
              const response = await next();
              calls.push("a:after");
              return response;
            },
          },
        ],
      },
      { defaults: [{ middleware: (_request, next) => (calls.push("default"), next()) }] },
    );

    await ctx.handleRequest(new Request("https://example.com/"), async () => {
      calls.push("runtime");
      return new Response("ok");
    });
    expect(calls).toEqual(["a", "default", "runtime", "a:after"]);
  });

  it("hands a rewrite to the runtime, which re-enters the chain", async () => {
    const later = vi.fn((_request: Request, next: () => Promise<Response>) => next());
    const ctx = await createSite({
      plugins: [{ middleware: (_request, next) => next("/other") }, { middleware: later }],
    });
    const next = vi.fn(async (rewrite?: string) => new Response(rewrite));

    const response = await ctx.handleRequest(new Request("https://example.com/"), next);
    await expect(response.text()).resolves.toBe("/other");
    expect(next).toHaveBeenCalledWith("/other");
    expect(later).not.toHaveBeenCalled();
  });
});

describe("URLs", () => {
  it("prefixes the base path", async () => {
    const ctx = await createSite({}, { base: "/repo/" });

    expect(ctx.withBase("/docs/basics")).toBe("/repo/docs/basics");
    expect(ctx.withBase("/")).toBe("/repo");
    expect((await createSite()).withBase("/docs")).toBe("/docs");
  });

  it("joins absolute URLs to `site.baseUrl`", async () => {
    const ctx = await createSite(
      { site: { baseUrl: "https://example.com/repo" } },
      { base: "/repo/" },
    );

    expect(ctx.absoluteUrl("/docs/basics")).toBe("https://example.com/repo/docs/basics");
    expect(ctx.absoluteUrl("https://cdn.example.com/a.png")).toBe("https://cdn.example.com/a.png");
    expect((await createSite()).absoluteUrl("/")).toBe("https://example.com/");
  });

  it("ends page URLs with the trailing slash of the framework", async () => {
    const ctx = await createSite({ i18n }, { trailingSlash: true });
    const page = await getPage(ctx, ["docs", "basics"], "en");

    expect(ctx.absoluteUrl("/docs")).toBe("https://example.com/docs/");
    expect(ctx.absoluteUrl("/")).toBe("https://example.com/");
    expect(ctx.absoluteUrl("/sitemap.xml")).toBe("https://example.com/sitemap.xml");
    expect((await createSite()).absoluteUrl("/docs")).toBe("https://example.com/docs");
    expect(await ctx.getHead({ page })).toContainEqual({
      tag: "link",
      attrs: { rel: "canonical", href: "https://example.com/en/docs/basics/" },
    });
  });

  it("ends the URLs of routes rendered on request with the trailing slash, once the routes are collected", async () => {
    const GET = () => new Response();
    const ctx = await createSite(
      {
        site: { baseUrl: undefined },
        plugins: [
          {
            routes({ createApi, createView }) {
              createApi({ path: "/api/ai", POST: GET });
              createApi({ path: "/api/feedback/[name]", POST: GET });
              createApi({ path: "/robots.txt", GET });
              createApi({ path: "/api/search", render: "static", GET });
              createView({ path: "/live/[id]", render: "dynamic", view: () => undefined });
              createView({ path: "/blog", view: () => undefined });
            },
          },
        ],
      },
      { base: "/repo/", trailingSlash: true },
    );

    expect(ctx.withBase("/api/ai")).toBe("/repo/api/ai");
    await ctx.getRoutes();
    expect(ctx.withBase("/api/ai")).toBe("/repo/api/ai/");
    expect(ctx.withBase("/api/feedback/page")).toBe("/repo/api/feedback/page/");
    expect(ctx.withBase("/live/1")).toBe("/repo/live/1/");
    expect(ctx.absoluteUrl("/api/ai")).toBe("/repo/api/ai/");
    // files, static routes and pages keep their path
    for (const path of ["/robots.txt", "/api/search", "/blog", "/docs", "/"])
      expect(ctx.withBase(path)).toBe(path === "/" ? "/repo" : `/repo${path}`);

    const plain = await createSite({
      plugins: [
        { routes: ({ createApi }) => createApi({ path: "/api/ai", render: "dynamic", POST: GET }) },
      ],
    });
    await plain.getRoutes();
    expect(plain.withBase("/api/ai")).toBe("/api/ai");
  });

  it("falls back to the base path without `site.baseUrl`", async () => {
    const ctx = await createSite({ site: { baseUrl: undefined } }, { base: "/repo/" });

    expect(ctx.absoluteUrl("/docs/basics")).toBe("/repo/docs/basics");
  });

  it("localizes paths unless the locale is hidden", async () => {
    const prefixed = await createSite({ i18n });
    const hidden = await createSite({ i18n: { ...i18n, hideLocale: "default-locale" } });

    expect(prefixed.localizePath("en", "/blog")).toBe("/en/blog");
    expect(prefixed.localizePath("cn", "/")).toBe("/cn");
    expect(prefixed.localizePath(undefined, "/blog")).toBe("/blog");
    expect(hidden.localizePath("en", "/blog")).toBe("/blog");
    expect(hidden.localizePath("cn", "/blog")).toBe("/cn/blog");
    expect((await createSite()).localizePath("en", "/blog")).toBe("/blog");
  });

  it("fills the defaults of `site.git`", async () => {
    const ctx = await createSite({
      site: { git: { user: "fuma-nama", repo: "fumapress", branch: "dev" } },
    });
    const { git } = ctx.siteConfig;

    expect(git).toMatchObject({ provider: "github", url: "https://github.com" });
    expect(git && existsSync(path.join(git.rootDir, ".git"))).toBe(true);
    expect(path.relative(git?.rootDir ?? "", process.cwd()).startsWith("..")).toBe(false);
  });

  it("links files on the git provider", async () => {
    const git = { user: "fuma-nama", repo: "fumapress", branch: "dev", rootDir: "/repo" };
    const fileUrl = async (site: TestSite["site"], file = "/repo/content/index.mdx") =>
      (await createSite({ site })).getFileUrl(file);

    await expect(fileUrl({ git })).resolves.toBe(
      "https://github.com/fuma-nama/fumapress/blob/dev/content/index.mdx",
    );
    await expect(
      fileUrl({ git: { ...git, provider: "gitlab", url: "https://gitlab.example.com/" } }),
    ).resolves.toBe("https://gitlab.example.com/fuma-nama/fumapress/-/blob/dev/content/index.mdx");
    await expect(fileUrl({ git: { ...git, provider: "bitbucket" } })).resolves.toBe(
      "https://bitbucket.org/fuma-nama/fumapress/src/dev/content/index.mdx",
    );
    await expect(fileUrl({ git }, "/other/index.mdx")).resolves.toBeUndefined();
    await expect(fileUrl({})).resolves.toBeUndefined();
  });
});

describe("getBaseOptions", () => {
  it("links the nav title to the home of the language", async () => {
    const ctx = await createSite({ i18n, site: { name: "Docs" } });
    const hidden = await createSite({ i18n: { ...i18n, hideLocale: "default-locale" } });
    const custom = await createSite({
      i18n,
      ui: { baseOptions: () => ({ nav: { url: "/docs" } }) },
    });

    await expect(ctx.getBaseOptions({ lang: "cn" })).resolves.toEqual({
      nav: { title: "Docs", url: "/cn" },
    });
    await expect(hidden.getBaseOptions({ lang: "en" })).resolves.toMatchObject({
      nav: { url: "/" },
    });
    await expect(custom.getBaseOptions({ lang: "cn" })).resolves.toMatchObject({
      nav: { url: "/docs" },
    });
  });

  it("merges the site's options over the plugins' contributions", async () => {
    const ctx = await createSite({
      ui: { baseOptions: { nav: { title: "Acme" }, links: [{ text: "Docs", url: "/docs" }] } },
      plugins: [
        {
          baseOptions: () => ({
            nav: { title: "Mintlify", transparentMode: "top" },
            links: [{ text: "Blog", url: "/blog" }],
          }),
        },
        {
          baseOptions: () => ({
            nav: { transparentMode: "always" },
            links: [{ text: "API", url: "/api" }],
          }),
        },
      ],
    });

    await expect(ctx.getBaseOptions({ lang: undefined })).resolves.toEqual({
      nav: { title: "Acme", transparentMode: "top", url: "/" },
      links: [
        { text: "Docs", url: "/docs" },
        { text: "Blog", url: "/blog" },
        { text: "API", url: "/api" },
      ],
    });
  });

  it("links the repository", async () => {
    const git = { user: "fuma-nama", repo: "fumapress", branch: "dev", rootDir: "/repo" };
    const github = await createSite({ site: { git } });
    const gitlab = await createSite({
      site: { git: { ...git, provider: "gitlab" } },
      ui: { baseOptions: { links: [{ text: "Blog", url: "/blog" }] } },
    });
    const custom = await createSite({
      site: { git: { ...git, provider: "gitlab" } },
      ui: { baseOptions: { githubUrl: "https://github.com/fuma-nama/fumadocs" } },
    });

    await expect(github.getBaseOptions({ lang: undefined })).resolves.toMatchObject({
      githubUrl: "https://github.com/fuma-nama/fumapress",
    });
    const { links } = await gitlab.getBaseOptions({ lang: undefined });
    expect(links).toMatchObject([
      { text: "Blog", url: "/blog" },
      {
        type: "icon",
        label: "GitLab",
        url: "https://gitlab.com/fuma-nama/fumapress",
        external: true,
      },
    ]);
    await expect(custom.getBaseOptions({ lang: undefined })).resolves.not.toHaveProperty("links");
  });
});

it("gives the root provider `ui.providerProps` over the plugins' by language", async () => {
  const ctx = await createSite({
    i18n,
    ui: {
      providerProps: ({ lang }) => ({ theme: { defaultTheme: lang === "cn" ? "dark" : "light" } }),
    },
    plugins: [{ providerProps: () => ({ theme: { defaultTheme: "system", enabled: true } }) }],
  });

  await expect(ctx.getProviderProps({ lang: "cn" })).resolves.toEqual({
    theme: { defaultTheme: "dark", enabled: true },
    search: { enabled: false },
  });
  await expect((await createSite({})).getProviderProps({ lang: undefined })).resolves.toEqual({
    search: { enabled: false },
  });
});

it("keeps React objects of `ui.providerProps` by reference", async () => {
  const SearchDialog = lazy(async () => ({ default: () => null }));
  const ctx = await createSite({ ui: { providerProps: { search: { SearchDialog } } } });

  expect((await ctx.getProviderProps({ lang: undefined })).search?.SearchDialog).toBe(SearchDialog);
});

describe("renderPage", () => {
  const renderDefault = (props: DefaultPageProps) =>
    createElement("main", null, props.type ?? "default");

  async function render(site: Partial<TestSite>, target: (ctx: Context) => Promise<RenderTarget>) {
    const press = testPress({ content: { files }, ...site });
    const ctx = await pressContext({ content: { files }, ...site });
    return renderPage(ctx, press, await target(ctx), renderDefault);
  }

  it("builds the props of content pages: data, body, named slots and the props of the owner", async () => {
    let props: DefaultPageProps | undefined;
    const node = await render(
      {
        plugins: [
          {
            getPageBody: () => ({ node: "body" }),
            getPageView: () => ({ props: { post: { title: "Post" } }, node: "post" }),
            slots: ({ page }) =>
              page && [
                { slot: "actions", name: "share", component: () => "share" },
                {
                  slot: "body.wrapper",
                  component: ({ children }: { children: string }) => children,
                },
              ],
          },
        ],
        ui: {
          renderPage(input: DefaultPageProps) {
            props = input;
            return input.renderDefault();
          },
        } satisfies PressConfig<AppShape, any>["ui"],
      },
      async (ctx) => ({ lang: undefined, page: await getPage(ctx, ["docs", "basics"]) }),
    );

    expect(node).toEqual(createElement("main", null, "default"));
    expect(props).toMatchObject({
      type: undefined,
      slugs: ["docs", "basics"],
      pageData: { title: "docs/basics.mdx" },
      post: { title: "Post" },
      baseOptions: { nav: { title: "Fumapress" } },
    });
    expect(
      props && "body" in props && isValidElement(props.body) && isValidElement(props.children),
    ).toBe(true);
    expect(Object.keys((props && "actions" in props && props.actions) || {})).toEqual(["share"]);
    expect(props?.tree.children.length).toBeGreaterThan(0);
  });

  it("hands the owning plugin the body of `props.body`, resolved once", async () => {
    const getPageBody = vi.fn(() => ({ node: "body" }));
    let owned: ReactNode;
    let props: DefaultPageProps | undefined;
    await render(
      {
        plugins: [
          {
            getPageBody,
            getPageView(_page, body) {
              owned = body?.node;
              return { props: {}, node: body?.node };
            },
            slots: ({ page }) =>
              page && [
                {
                  slot: "body.wrapper",
                  component: ({ children }: { children: string }) => children,
                },
              ],
          },
        ],
        ui: {
          renderPage(input: DefaultPageProps) {
            props = input;
            return input.renderDefault();
          },
        } satisfies PressConfig<AppShape, any>["ui"],
      },
      async (ctx) => ({ lang: undefined, page: await getPage(ctx, ["docs", "basics"]) }),
    );

    expect(getPageBody).toHaveBeenCalledOnce();
    expect(isValidElement(owned) && owned.props).toEqual({ children: "body" });
    expect(props && "body" in props && props.body.props).toEqual({ children: owned });
  });

  it("builds the props of views, and renders the default without `ui.renderPage`", async () => {
    const node = (await render({}, async () => ({
      lang: undefined,
      view: { type: "blog.index", props: { posts: [] }, node: "posts" },
    }))) as ReactElement;

    expect(node).toEqual(createElement("main", null, "blog.index"));
  });
});

describe("types", () => {
  it("checks views against the types of the plugin", () => {
    const plugin: Plugin<AppShape, { views: { x: { ok: boolean } } }> = {
      routes({ createView }) {
        createView({ path: "/x", view: () => ({ type: "x", props: { ok: true }, node: null }) });
        // @ts-expect-error -- not a view of the plugin
        createView({ path: "/y", view: () => ({ type: "y", props: {}, node: null }) });
        // @ts-expect-error -- a view has no handlers
        createView({ path: "/z", GET });
      },
    };
    expect(plugin.routes).toBeTypeOf("function");
  });

  it("fits a framework plugin in every site", () => {
    const framework: FrameworkPlugin = {
      routes: ({ createApi }) => createApi({ path: "/api", ALL: () => new Response() }),
    };
    const press: Plugin<AppShape> = framework;
    expect(press).toBe(framework);
  });
});
