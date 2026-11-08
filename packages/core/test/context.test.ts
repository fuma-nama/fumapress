import { existsSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isValidElement, lazy, type ReactElement, type ReactNode } from "react";
import { defineI18n } from "fumadocs-core/i18n";
import type { _Internal, PageData, VirtualFile } from "fumadocs-core/source";
import { createPressContext, type Context, type RuntimeContext } from "@/context";
import { wrapRoot } from "@/runtime/render";
import type { HeadTag } from "@/head";
import type { AppShape, Plugin, PluginTypes, PresetEntry } from "@/plugin";
import {
  matchRoute,
  type ApiRoute,
  type PageRoute,
  type PageRouteInput,
  type ViewRoute,
} from "@/routes";
import type {
  ContentPageProps,
  DefaultPageProps,
  PressConfig,
  RenderTarget,
  ViewPageProps,
} from "@/press";
import { takumiPlugin } from "@/plugins/takumi";
import { DefaultDocs } from "@/ui/docs";
import { HomeShell } from "@/ui/home";
import { i18n, pressContext, testPress, type TestRuntime, type TestSite } from "./harness";

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
function ownRoute(path: string, lang?: string): PageRouteInput {
  return { path, lang, render: "static" };
}

type SitePlugin = Plugin<AppShape, any>;

function apiPlugin(name: string | undefined, ...routes: ApiRoute[]): SitePlugin {
  return {
    name,
    routes({ createApi }) {
      for (const route of routes) createApi(route);
    },
  };
}

function viewPlugin(name: string | undefined, ...routes: ViewRoute[]): SitePlugin {
  return {
    name,
    routes({ createView }) {
      for (const route of routes) createView(route);
    },
  };
}

/** a view rendering nothing */
const blank = (path: string): ViewRoute => ({ path, view: () => undefined });
const paths = (routes: readonly { path: string }[]) => routes.map((route) => route.path);

const git = { user: "fuma-nama", repo: "fumapress", branch: "dev", rootDir: "/repo" };

const title = (children: string): HeadTag => ({ tag: "title", children });
const meta = (name: string, content: string): HeadTag => ({
  tag: "meta",
  attrs: { name, content },
});
const og = (property: string, content: string): HeadTag => ({
  tag: "meta",
  attrs: { property, content },
});
const link = (rel: string, href: string): HeadTag => ({ tag: "link", attrs: { rel, href } });
const alternate = (hreflang: string, href: string): HeadTag => ({
  tag: "link",
  attrs: { rel: "alternate", hreflang, href },
});
const noindex = meta("robots", "noindex");

async function headOf(ctx: RuntimeContext, slugs: string[], lang?: string) {
  const page = await getPage(ctx, slugs, lang);
  return ctx.getHead({ lang: page.locale, page });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createPressContext", () => {
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
    expect(translations.get("en")).toEqual({ Copy: "Copy", Search: "Search" });
    expect((await createSite({ i18n })).translationsConfig).toBeUndefined();
  });

  it("revalidates dynamic sources", async () => {
    let list = [page("index.mdx")];
    const ctx = await createSite({ content: { files: () => list } });
    const always = await createSite({
      content: { files: () => list },
      alwaysRevalidate: true,
    });
    expect((await ctx.getLoader()).getPages()).toHaveLength(1);
    expect((await always.getLoader()).getPages()).toHaveLength(1);
    list = [page("index.mdx"), page("other.mdx")];

    expect((await ctx.getLoader()).getPages()).toHaveLength(1);
    await ctx.revalidateLoader();
    expect((await ctx.getLoader()).getPages()).toHaveLength(2);
    expect((await always.getLoader()).getPages()).toHaveLength(2);
  });
});

describe("layers", () => {
  const entry = (name: string): PresetEntry<Plugin<AppShape, any>> =>
    vi.fn(() => ({ name: `core:${name}` }));

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

  it("uses the runtime's preset without `preset`, none with `[]`", async () => {
    const preset = vi.fn(() => [entry("image")]);
    expect((await createSite({ preset: undefined }, { preset })).plugins).toHaveLength(1);
    expect((await createSite({}, { preset })).plugins).toHaveLength(0);
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
});

describe("getPageData", () => {
  it("fills the data from the page and plugins, loading nothing of the content", async () => {
    const getPageToc = vi.fn(() => [{ title: "Intro", url: "#intro", depth: 2 }]);
    const getPageLastModified = vi.fn(() => new Date(0));
    const ctx = await createSite({
      i18n,
      site: { git },
      plugins: [{ getPageToc, getPageLastModified }],
    });

    await expect(ctx.getPageData(await getPage(ctx, ["docs", "basics"], "cn"))).resolves.toEqual({
      title: "docs/basics.cn.mdx",
      description: "About docs/basics.cn.mdx",
      url: "/cn/docs/basics",
      path: "docs/basics.cn.mdx",
      locale: "cn",
      full: undefined,
      noindex: undefined,
      githubUrl: "https://github.com/fuma-nama/fumapress/blob/dev/content/docs/basics.cn.mdx",
    });
    expect(getPageToc).not.toHaveBeenCalled();
    expect(getPageLastModified).not.toHaveBeenCalled();
  });

  it("keeps fallback pages out of search engines", async () => {
    const ctx = await createSite({ i18n });

    await expect(
      ctx.getPageData(await getPage(ctx, ["docs", "only-en"], "cn")),
    ).resolves.toMatchObject({ noindex: true });
    await expect(
      ctx.getPageData(await getPage(ctx, ["docs", "basics"], "cn")),
    ).resolves.toMatchObject({ noindex: undefined });
  });

  it("gives the pages of a page route its data, transformed for the path", async () => {
    const ctx = await createSite(
      {
        i18n,
        plugins: [
          {
            transformPage(data, { route, path }) {
              if (route) return { description: `at ${path}` };
            },
          },
        ],
      },
      { routes: [{ path: "/about", lang: "cn", render: "static", data: { title: "About" } }] },
    );
    const [route] = await ctx.getPageRoutes();

    await expect(ctx.getPageData(route!, "/cn/about")).resolves.toEqual({
      title: "About",
      description: "at /cn/about",
      url: "/cn/about",
      locale: "cn",
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
});

describe("configureLoader", () => {
  it("collects loader plugins in layer order, after the site's", async () => {
    const ran: string[] = [];
    const plugin = (name: string) => ({ name, transformStorage: () => void ran.push(name) });
    const own = plugin("own");
    const given: unknown[] = [];
    const ctx = await createSite({
      loaderPlugins: [own],
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

  it("lets the site's option win over writers", async () => {
    const write = (name: string) => ({ name, configureLoader: () => ({ url: () => "/x" }) });
    const ctx = await createSite({
      url: () => "/site",
      plugins: [write("a"), write("b")],
    });

    expect((await getPage(ctx, ["docs", "basics"])).url).toBe("/site");
  });
});

describe("getHead", () => {
  it("keys tags: yours over plugins', theirs over core's, a page's over every page's", async () => {
    const defaultImage = og("og:image", "/default.png");
    const icon = link("icon", "/favicon.ico");
    const ctx = await createSite({
      head: ({ page }) => (page ? [meta("description", "site")] : [defaultImage, icon]),
      plugins: [
        {
          head: ({ page }) => [
            title("plugin"),
            icon,
            ...(page ? [og("og:image", "/page.png")] : []),
          ],
        },
        { head: () => [title("second")] },
      ],
    });
    const tags = await headOf(ctx, ["docs", "basics"]);

    expect(tags.filter((tag) => tag.tag === "title")).toEqual([title("plugin")]);
    expect(tags).toContainEqual(meta("description", "site"));
    expect(tags).toContainEqual(og("og:image", "/page.png"));
    expect(tags.filter((tag) => tag.attrs?.rel === "icon")).toHaveLength(1);
    expect(tags).toContainEqual(og("og:title", "docs/basics.mdx"));
    await expect(ctx.getHead({ lang: undefined })).resolves.toEqual([
      defaultImage,
      icon,
      title("plugin"),
    ]);
  });

  it("keys the title and description of page routes over the ones of every page", async () => {
    const ctx = await createSite({ head: [title("Site"), meta("description", "A site")] });
    const route: PageRoute = {
      path: "/blog",
      render: "static",
      pages: [],
      data: { title: "Blog", description: "Posts" },
    };
    const head = await ctx.getHead({ lang: undefined, route, path: "/blog" });

    expect(head.filter((tag) => tag.tag === "title")).toEqual([title("Blog")]);
    expect(head.filter((tag) => tag.attrs?.name === "description")).toEqual([
      meta("description", "Posts"),
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
      data: {},
      pages: [{ path: "/cn/about", translations, params: {} }],
    };

    await expect(ctx.getHead({ lang: "cn", route, path: "/cn/about" })).resolves.toEqual([
      link("canonical", "https://example.com/cn/about"),
      og("og:url", "https://example.com/cn/about"),
      alternate("en", "https://example.com/en/about"),
      alternate("cn", "https://example.com/cn/about"),
      alternate("x-default", "https://example.com/en/about"),
    ]);
  });
});

describe("getHead of content pages", () => {
  it("returns the defaults of content pages", async () => {
    const ctx = await createSite({ i18n, site: { hreflang: { cn: "zh-Hans" } } });

    await expect(headOf(ctx, ["docs", "basics"], "en")).resolves.toEqual([
      title("docs/basics.mdx"),
      meta("description", "About docs/basics.mdx"),
      og("og:title", "docs/basics.mdx"),
      og("og:description", "About docs/basics.mdx"),
      og("og:site_name", "Fumapress"),
      link("canonical", "https://example.com/en/docs/basics"),
      og("og:url", "https://example.com/en/docs/basics"),
      alternate("en", "https://example.com/en/docs/basics"),
      alternate("zh-Hans", "https://example.com/cn/docs/basics"),
      alternate("x-default", "https://example.com/en/docs/basics"),
    ]);
  });

  it.each<[string, VirtualFile[]]>([
    ["with an absolute path", files],
    ["without an absolute path", files.map((file) => ({ ...file, absolutePath: undefined }))],
  ])("marks fallback pages noindex, with the canonical of their origin, %s", async (_, files) => {
    const ctx = await createSite({ i18n, content: { files } });

    for (const slugs of [
      ["docs", "only-en"],
      ["docs", "shared"],
    ]) {
      const tags = await headOf(ctx, slugs, "cn");
      expect(tags).toContainEqual(noindex);
      expect(tags).toContainEqual(link("canonical", `https://example.com/en/${slugs.join("/")}`));
      expect(tags.some((tag) => tag.attrs?.rel === "alternate")).toBe(false);
    }

    const translated = await headOf(ctx, ["docs", "basics"], "cn");
    expect(translated).not.toContainEqual(noindex);
    expect(translated).toContainEqual(link("canonical", "https://example.com/cn/docs/basics"));
  });

  it("skips canonical without `site.baseUrl`", async () => {
    const ctx = await createSite({ site: { baseUrl: undefined } });
    const tags = await headOf(ctx, ["docs", "basics"]);

    expect(
      tags.some((tag) => tag.attrs?.rel === "canonical" || tag.attrs?.property === "og:url"),
    ).toBe(false);
  });
});

describe("getSlots", () => {
  it("groups items by region, sorted by order, then by layer and list order", async () => {
    const item = (id: string, order?: number) => ({
      name: `test:${id}`,
      region: "layout-wrapper" as const,
      component: () => null,
      props: { id },
      order,
    });
    const ctx = await createSite({
      plugins: [
        { slots: () => [item("a", 1), item("b")] },
        { slots: () => [item("c"), item("provider", -1)] },
      ],
      preset: [() => ({ slots: () => [item("d")] })],
    });
    const items = (await ctx.getSlots({ lang: undefined }))["layout-wrapper"] ?? [];

    expect(items.map((item) => item.props?.id)).toEqual(["provider", "b", "c", "d", "a"]);
  });
});

describe("slot items in the wrong call", () => {
  const item = (region: "footer" | "banner", name = "acme:x") => ({
    name,
    region,
    component: () => null,
  });

  it.each<[string, SitePlugin, string, boolean]>([
    [
      "a region of a content page in the site-wide call",
      { name: "a", slots: () => [item("footer")] },
      '"a" adds the slot item "acme:x" to "footer" in the site-wide `slots` call',
      false,
    ],
    [
      "a site-wide region in the call of a content page",
      { name: "a", slots: ({ page }) => page && [item("banner")] },
      '"a" adds the slot item "acme:x" to "banner" in the `slots` call of a content page',
      true,
    ],
    [
      "a name with the prefix of core",
      { name: "a", slots: ({ page }) => page && [item("footer", "core:markdown")] },
      "the `core:` prefix is Fumapress' own",
      true,
    ],
  ])("are errors: %s", async (_, plugin, message, onPage) => {
    const ctx = await createSite({ plugins: [plugin] });
    const page = await getPage(ctx, []);
    await expect(
      ctx.getSlots(onPage ? { lang: undefined, page } : { lang: undefined }),
    ).rejects.toThrow(message);
  });
});

describe("wrapRoot", () => {
  it("renders the `banner` items above every page, inside `layout-wrapper`", async () => {
    const Frame = ({ children }: { children: ReactNode }) => children;
    const Banner = () => null;
    const ctx = await createSite({
      plugins: [
        {
          slots: ({ page }) =>
            page
              ? undefined
              : [
                  { name: "test:banner", region: "banner", component: Banner },
                  { name: "test:frame", region: "layout-wrapper", component: Frame },
                ],
        },
      ],
    });
    const root = wrapRoot(await ctx.getSlots({ lang: undefined }), "page") as ReactElement<{
      children: ReactElement<{ children?: ReactNode }>[];
    }>;

    expect(root.type).toBe(Frame);
    const [banner, page] = root.props.children;
    expect(banner?.type).toBe(Banner);
    expect(page?.props.children).toBe("page");
  });
});

describe("Cache-Control of pages rendered on demand", () => {
  it("reads the content only for a source with a `staleTime`", async () => {
    const files = vi.fn(() => [page("index.mdx")]);
    const request = (ctx: RuntimeContext) =>
      ctx.handleRequest(new Request("https://example.com/"), async () => new Response("page"));

    const plain = await createSite({ content: { files } });
    // a read of the content would revalidate it
    plain.invalidateLoader();
    files.mockClear();
    await request(plain);
    expect(files).not.toHaveBeenCalled();

    const cached = await createSite({ content: { files, staleTime: 60_000 } });
    expect((await request(cached)).headers.get("Cache-Control")).toBe("public, s-maxage=60");
  });
});

describe("getContentRender", () => {
  const live = { files: () => [page("live/status.mdx")] };

  it("is dynamic on one dynamic source, for its pages too", async () => {
    const ctx = await createSite({ content: { files: () => files } });
    const [first] = (await ctx.getLoader()).getPages();

    expect(ctx.getContentRender()).toBe("dynamic");
    expect(ctx.getContentRender(first!.type)).toBe("dynamic");
  });

  it("answers per source, any source without a key", async () => {
    const ctx = await createSite({ content: { docs: { files }, live } });

    expect(ctx.getContentRender("docs")).toBe("static");
    expect(ctx.getContentRender("live")).toBe("dynamic");
    expect(ctx.getContentRender()).toBe("dynamic");
  });

  it("follows `mode`, of every source or by source key", async () => {
    const forced = await createSite({ content: { docs: { files }, live }, mode: "force-dynamic" });
    expect(forced.getContentRender("docs")).toBe("dynamic");

    const prerendered = await createSite({
      content: { docs: { files }, live },
      mode: "force-static",
    });
    expect(prerendered.getContentRender("live")).toBe("static");
    expect(prerendered.getContentRender()).toBe("static");

    const keyed = await createSite({
      content: { docs: { files }, live },
      mode: { docs: "force-dynamic", live: "force-static" },
    });
    expect(keyed.getContentRender("docs")).toBe("dynamic");
    expect(keyed.getContentRender("live")).toBe("static");
  });

  it("takes `auto` of the runtime, sources with a `mode` keep theirs", async () => {
    const ctx = await createSite(
      { content: { docs: { files }, live }, mode: { live: "force-static" } },
      { mode: "force-dynamic" },
    );

    expect(ctx.getContentRender("docs")).toBe("dynamic");
    expect(ctx.getContentRender("live")).toBe("static");
  });
});

describe("getCacheControl", () => {
  it("keeps pages rendered on demand for the `staleTime` of their dynamic source", async () => {
    const content = {
      docs: { files },
      live: { files: () => [page("live/status.mdx")], staleTime: 60_500 },
      fresh: { files: () => [page("fresh.mdx")] },
    };
    const ctx = await createSite({ content });
    const cacheControl = async (url: string) =>
      ctx.getCacheControl((await ctx.getLoader()).getPageByUrl(url)!);

    expect(await cacheControl("/live/status")).toBe("public, s-maxage=60");
    expect(await cacheControl("/fresh")).toBeUndefined();
    expect(await cacheControl("/docs/basics")).toBeUndefined();

    // prerendered
    const built = await createSite({ content, mode: { live: "force-static" } });
    const status = (await built.getLoader()).getPageByUrl("/live/status")!;
    expect(built.getCacheControl(status)).toBeUndefined();
  });

  it("sets it on the response of a page rendered on demand, unless a route takes the page", async () => {
    const live = { files: () => [page("status.mdx"), page("taken.mdx")], staleTime: 30_000 };
    const ctx = await createSite(
      { content: live },
      { routes: [{ path: "/taken", render: "static" }] },
    );
    const fetch = (path: string, init?: RequestInit) =>
      ctx.handleRequest(
        new Request(`http://localhost${path}`, init),
        async () => new Response("page"),
      );

    expect((await fetch("/status")).headers.get("Cache-Control")).toBe("public, s-maxage=30");
    expect((await fetch("/taken")).headers.get("Cache-Control")).toBeNull();
    expect((await fetch("/status", { method: "POST" })).headers.get("Cache-Control")).toBeNull();
    const missing = await ctx.handleRequest(
      new Request("http://localhost/status"),
      async () => new Response(null, { status: 500 }),
    );
    expect(missing.headers.get("Cache-Control")).toBeNull();
  });
});

describe("getApiRoutes", () => {
  it("renders on demand by default, static routes stay static on any content", async () => {
    const plugin = apiPlugin(undefined, { path: "/a", GET, render: "static" }, { path: "/b", GET });
    const renders = async (site: Partial<TestSite>, runtime?: TestRuntime) =>
      (await (await createSite({ ...site, plugins: [plugin] }, runtime)).getApiRoutes()).map(
        (route) => route.render,
      );

    await expect(renders({})).resolves.toEqual(["static", "dynamic"]);
    await expect(renders({ content: { files: () => files } })).resolves.toEqual([
      "static",
      "dynamic",
    ]);
    await expect(renders({ mode: "force-dynamic" })).resolves.toEqual(["static", "dynamic"]);
  });

  const og: ApiRoute = { path: "/og/[...slugs]", render: "static", GET };

  it.each<[string, ApiRoute, string]>([
    [
      "a POST handler",
      { path: "/api", render: "static", GET, POST: GET },
      'the static route "/api" is generated from its GET handler, its POST handler needs',
    ],
    ["an ALL handler", { path: "/api", render: "static", ALL: GET }, "its ALL handler needs"],
    ["params without `staticPaths`", og, 'the static route "/og/[...slugs]" has params'],
  ])("rejects static routes with %s", async (_, route, message) => {
    const ctx = await createSite({ plugins: [apiPlugin(undefined, route)] });

    await expect(ctx.getApiRoutes()).rejects.toThrow(message);
  });

  it("leaves the pages of a page pattern to static routes, which serve their listed paths only", async () => {
    const plain = await createSite(
      { plugins: [takumiPlugin()] },
      { routes: [ownRoute("/[...slug]")] },
    );
    const localized = await createSite(
      { i18n, plugins: [takumiPlugin()] },
      { routes: [ownRoute("/[...slug]", "en"), ownRoute("/[...slug]", "cn")] },
    );
    const onRequest = await createSite(
      { plugins: [apiPlugin("x", { path: "/[...slugs]", GET })] },
      { routes: [ownRoute("/[...slug]")] },
    );

    expect(paths(await plain.getApiRoutes())).toEqual(["/[...slugs]"]);
    expect(paths(await localized.getApiRoutes())).toEqual(["/en/[...slugs]", "/cn/[...slugs]"]);
    await expect(onRequest.getApiRoutes()).rejects.toThrow(
      'a custom page and "x" both take the path "/[...slugs]"',
    );
  });

  it("serves a path with a route group without the group", async () => {
    const ctx = await createSite({
      plugins: [apiPlugin(undefined, { path: "/(group)/api/[id]", GET })],
    });
    const [route] = await ctx.getApiRoutes();

    expect(route?.path).toBe("/api/[id]");
    expect(matchRoute(route!.path, "/api/1")).toEqual({ id: "1" });
  });

  it("sorts routes by specificity", async () => {
    const ctx = await createSite({
      plugins: [
        apiPlugin(
          undefined,
          { path: "/api/[...rest]", GET },
          { path: "/api/[id]", GET },
          { path: "/api/list", GET },
        ),
      ],
    });

    expect(paths(await ctx.getApiRoutes())).toEqual(["/api/list", "/api/[id]", "/api/[...rest]"]);
  });
});

describe("a concept has one writer", () => {
  const url = () => "/x";
  const view = () => ({ props: {}, node: null });
  const home = (ctx: Context) => getPage(ctx, []);

  it.each<[string, SitePlugin[], string, ((ctx: RuntimeContext) => Promise<unknown>)?]>([
    [
      "the renderer of a page, in one layer",
      [
        { name: "blog", getPageView: view },
        { name: "notes", getPageView: view },
      ],
      '"blog" and "notes" both answer `getPageView` for "/": a page has one renderer.',
      async (ctx) => ctx.getPageView(await home(ctx), undefined),
    ],
    [
      "a field of `transformPage`",
      [
        { name: "acme:md", transformPage: (data) => ({ ...data, markdownUrl: "/a.md" }) },
        { name: "core:llms.txt", transformPage: (data) => ({ ...data, markdownUrl: "/b.md" }) },
      ],
      '"acme:md" and "core:llms.txt" both set `markdownUrl` of the page "/"',
      async (ctx) => ctx.getPageData(await home(ctx)),
    ],
    [
      "a loader option",
      [
        { name: "a", configureLoader: () => ({ url }) },
        { name: "b", configureLoader: () => ({ url }) },
      ],
      '"a" and "b" both set the loader option `url`',
    ],
    [
      "a slot item, in any region",
      (["actions", "footer"] as const).map((region, i) => ({
        name: ["a", "b"][i],
        slots: ({ page }) => page && [{ name: "acme:share", region, component: () => null }],
      })),
      '"a" and "b" both add the slot item "acme:share": a name has one item.',
      async (ctx) => ctx.getSlots({ lang: undefined, page: await home(ctx) }),
    ],
    [
      "a slot item, across the site-wide call and the page's",
      [
        {
          name: "a",
          slots: ({ page }) =>
            page ? undefined : [{ name: "acme:x", region: "banner", component: () => null }],
        },
        {
          name: "b",
          slots: ({ page }) =>
            page && [{ name: "acme:x", region: "footer", component: () => null }],
        },
      ],
      '"a" and "b" both add the slot item "acme:x": a name has one item.',
      async (ctx) => ctx.getSlots({ lang: undefined, page: await home(ctx) }),
    ],
  ])("rejects two writers of %s, naming both", async (_, plugins, message, read) => {
    await expect(createSite({ plugins }).then(read)).rejects.toThrow(message);
  });
});

describe("a path has one route", () => {
  const api = (name: string | undefined, path: string) => apiPlugin(name, { path, GET });
  const view = (name: string | undefined, path: string) => viewPlugin(name, blank(path));
  const basics = "/docs/basics";
  const onBasics = (name: string) => `the content page "${basics}" and "${name}"`;
  const showcase = (plugin: { name: string }) => [{ ...ownRoute("/showcase"), plugin }];

  it.each<[string, SitePlugin[], string, string, PageRouteInput[]?]>([
    ["two API routes", [api("a", "/api"), api("b", "/api")], '"a" and "b"', "/api"],
    ["an API route on a content page", [api("md", basics)], onBasics("md"), basics],
    [
      "plugins without names",
      [view(undefined, "/v"), view(undefined, "/v")],
      "an unnamed plugin and an unnamed plugin",
      "/v",
    ],
    [
      "a view on the page of a runtime hook",
      [view("x", "/showcase")],
      '"acme" and "x"',
      "/showcase",
      showcase({ name: "acme" }),
    ],
    [
      "an API route on a custom page",
      [api("x", "/about")],
      'a custom page and "x"',
      "/about",
      [ownRoute("/about")],
    ],
    [
      "a derived view on a content page",
      [{ name: "print", deriveRoutes: ({ createView }) => createView(blank(basics)) }],
      onBasics("print"),
      basics,
    ],
  ])("rejects %s, naming both", async (_, plugins, owners, path, routes) => {
    const ctx = await createSite({ plugins }, { routes });

    await expect(ctx.getApiRoutes()).rejects.toThrow(
      `${owners} both take the path "${path}": a path has one route.`,
    );
  });

  it("says a plugin is added twice, like a default plugin listed too", async () => {
    const ctx = await createSite({
      plugins: [api("core:rss", "/rss.xml"), api("core:rss", "/rss.xml")],
    });

    await expect(ctx.getApiRoutes()).rejects.toThrow('"core:rss" is added twice');
  });

  it("lets a route win over a page of a dynamic source, which can appear while the server runs", async () => {
    const ctx = await createSite({
      content: { files: () => files },
      plugins: [
        api("md", basics),
        viewPlugin("v", { ...blank("/[slug]/[page]"), render: "dynamic" }),
      ],
    });

    expect((await ctx.getApiRoutes()).map((route) => route.path)).toContain(basics);
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
    const routes = await ctx.getPageRoutes();
    for (const { view, lang } of routes) {
      if (view?.render !== "dynamic") await view?.view({}, { lang });
    }

    expect(langs).toEqual(["en", "cn"]);
    expect(routes.map(({ lang, view }) => [lang, view?.path])).toEqual([
      ["en", "/blog"],
      ["cn", "/blog"],
    ]);
    expect(routes.map((route) => route.path)).toEqual(["/en/blog", "/cn/blog"]);
    expect(routes[0]!.pages[0]!.translations).toEqual([
      { lang: "en", path: "/en/blog" },
      { lang: "cn", path: "/cn/blog" },
    ]);
  });

  it("give way to custom pages", async () => {
    const ctx = await createSite(
      { plugins: [viewPlugin("x", view("/about"), view("/blog"))] },
      { routes: [ownRoute("/about")] },
    );

    expect((await ctx.getPageRoutes()).map((route) => [route.path, route.view?.path])).toEqual([
      ["/about", undefined],
      ["/blog", "/blog"],
    ]);
  });

  it("give one of their pages to a custom page there, keeping the others", async () => {
    const tags = { ...view("/tags/[tag]"), staticPaths: ["a", "b"] };
    const ctx = await createSite(
      { plugins: [viewPlugin("tags", tags)] },
      { routes: [ownRoute("/tags/a")] },
    );
    const every = await createSite(
      { plugins: [viewPlugin("tags", { ...tags, staticPaths: ["a"] })] },
      { routes: [ownRoute("/tags/a")] },
    );
    const entry = (await ctx.getPageRoutes())[1];

    expect(paths(entry?.pages ?? [])).toEqual(["/tags/b"]);
    // runtimes register the view with its remaining pages
    expect(entry?.view?.staticPaths).toEqual([["b"]]);
    expect(paths(await every.getPageRoutes())).toEqual(["/tags/a"]);
  });

  // no home page: the base options look the home up in the routes
  it.each<[string, string, (ctx: Context) => Promise<unknown>]>([
    ["directly", "eager", (ctx) => ctx.getPageRoutes()],
    ["through the layout props", "nav", (ctx) => ctx.getLayoutProps({ lang: undefined })],
  ])("can't read the routes %s while plugins create them", async (_, name, read) => {
    const ctx = await createSite({
      content: { files: [page("docs/basics.mdx")] },
      plugins: [
        {
          name,
          async routes() {
            await read(this);
          },
        },
      ],
    });

    await expect(ctx.getApiRoutes()).rejects.toThrow(
      `"${name}" reads the routes while plugins create them`,
    );
  });
});

describe("runtime routes", () => {
  it("link custom pages and the views of other languages at a path as translations", async () => {
    const ctx = await createSite(
      {
        i18n,
        plugins: [{ routes: ({ createView }) => createView({ lang: "cn", ...blank("/about") }) }],
      },
      { routes: [ownRoute("/about", "en")] },
    );
    const translations = [
      { lang: "en", path: "/en/about" },
      { lang: "cn", path: "/cn/about" },
    ];

    for (const route of await ctx.getPageRoutes())
      expect(route.pages[0]?.translations).toEqual(translations);
  });

  it("are read once the runtime sets them, a new list replaces them", async () => {
    const ctx = await createPressContext(testPress({ content: { files } }), {
      base: "/",
      defaults: [],
      signal: new AbortController().signal,
      isClientReference: () => false,
    });

    await expect(ctx.getPageRoutes()).rejects.toThrow(
      "the routes are read before they are created",
    );
    ctx.setRuntimeRoutes([ownRoute("/a")]);
    expect(paths(await ctx.getPageRoutes())).toEqual(["/a"]);
    // a rerun of the runtime's routing
    ctx.setRuntimeRoutes([ownRoute("/b")]);
    expect(paths(await ctx.getPageRoutes())).toEqual(["/b"]);
  });

  it("of your own win over the pages of runtime hooks", async () => {
    const ctx = await createSite(
      {},
      {
        routes: [
          ownRoute("/a"),
          { ...ownRoute("/a"), plugin: { name: "acme" } },
          { ...ownRoute("/b"), plugin: { name: "acme" } },
        ],
      },
    );

    expect(paths(await ctx.getPageRoutes())).toEqual(["/a", "/b"]);
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
                createView({ lang, ...blank(`${route.path.replace(`/${lang}`, "")}/print`) });
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
      { routes: [ownRoute("/"), ownRoute("/about", "cn")] },
    );

    expect(paths(await ctx.getPageRoutes())).toEqual([
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
    expect(paths(await ctx.getApiRoutes())).toEqual(["/en/api/routes.json", "/cn/api/routes.json"]);
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
            // like the Markdown of custom pages, which read the site outside of plugin hooks
            async deriveRoutes() {
              rendered.push(
                await site!.getLayoutProps({ lang: undefined }),
                paths(await site!.getPageRoutes()),
              );
            },
          },
        ],
      },
      { routes: [ownRoute("/about")] },
    );
    site = ctx;

    await ctx.getApiRoutes();
    expect(rendered).toEqual([{ nav: { title: "Fumapress", url: "/docs/basics" } }, ["/about"]]);
  });
});

describe("alwaysRevalidate", () => {
  it("collects the routes once per content, reads and hooks of the routes don't revalidate", async () => {
    let collected = 0;
    const ctx = await createSite({
      content: { files: () => [page("index.mdx")] },
      alwaysRevalidate: true,
      plugins: [
        {
          async routes({ createApi }) {
            collected++;
            await this.getLoader();
            createApi({ path: "/api", GET });
          },
        },
      ],
    });

    await ctx.getPageRoutes();
    await ctx.getApiRoutes();
    await ctx.getPageRoutes();
    expect(collected).toBe(1);

    await ctx.getLoader();
    await ctx.getPageRoutes();
    expect(collected).toBe(2);
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
  type Site = [Partial<TestSite>, TestRuntime];
  const origin = "https://example.com";
  const plain: Site = [{}, {}];
  const repo: Site = [{}, { base: "/repo/" }];
  const repoUrl: Site = [{ site: { baseUrl: `${origin}/repo` } }, { base: "/repo/" }];
  const noUrl: Site = [{ site: { baseUrl: undefined } }, { base: "/repo/" }];
  const slash: Site = [{ site: { baseUrl: undefined } }, { base: "/repo/", trailingSlash: true }];
  const slashUrl: Site = [{}, { trailingSlash: true }];
  const cdn = "https://cdn.example.com/a.png";

  it.each<[string, Site, string, string]>([
    ["prefixes the base path", repo, "/docs/basics", "/repo/docs/basics"],
    ["drops the slash of the root", repo, "/", "/repo"],
    ["keeps paths without a base", plain, "/docs", "/docs"],
    ["adds the trailing slash", slash, "/api/ai", "/repo/api/ai/"],
    ["adds it before a hash", slash, "/docs#intro", "/repo/docs/#intro"],
    ["adds it before a query", slash, "/docs?a=b.c", "/repo/docs/?a=b.c"],
    ["adds none to files", slash, "/robots.txt", "/repo/robots.txt"],
    ["adds none to the root, for `stripBase()`", slash, "/", "/repo"],
  ])("withBase %s", async (_, [site, runtime], input, expected) => {
    expect((await createSite(site, runtime)).withBase(input)).toBe(expected);
  });

  it.each<[string, Site, string, string]>([
    ["joins `site.baseUrl`", repoUrl, "/docs/basics", `${origin}/repo/docs/basics`],
    ["keeps absolute URLs", repoUrl, cdn, cdn],
    ["joins the root", plain, "/", `${origin}/`],
    ["adds the trailing slash", slashUrl, "/docs", `${origin}/docs/`],
    ["adds none to the root", slashUrl, "/", `${origin}/`],
    ["adds none to files", slashUrl, "/sitemap.xml", `${origin}/sitemap.xml`],
    ["adds none by default", plain, "/docs", `${origin}/docs`],
    ["falls back to the base path", noUrl, "/docs/basics", "/repo/docs/basics"],
    ["falls back with the trailing slash", slash, "/api/ai", "/repo/api/ai/"],
  ])("absoluteUrl %s", async (_, [site, runtime], input, expected) => {
    expect((await createSite(site, runtime)).absoluteUrl(input)).toBe(expected);
  });

  it("ends the canonical of pages with the trailing slash of the framework", async () => {
    const ctx = await createSite({ i18n }, { trailingSlash: true });

    expect(await headOf(ctx, ["docs", "basics"], "en")).toContainEqual(
      link("canonical", "https://example.com/en/docs/basics/"),
    );
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

describe("getLayoutProps", () => {
  const layoutProps = async (config: Partial<TestSite>, lang?: string) =>
    (await createSite(config)).getLayoutProps({ lang });

  it("links the nav title to the home of the language", async () => {
    await expect(layoutProps({ i18n, site: { name: "Docs" } }, "cn")).resolves.toEqual({
      nav: { title: "Docs", url: "/cn" },
    });
    await expect(
      layoutProps({ i18n: { ...i18n, hideLocale: "default-locale" } }, "en"),
    ).resolves.toMatchObject({ nav: { url: "/" } });
    await expect(
      layoutProps({ i18n, ui: { layoutProps: () => ({ nav: { url: "/docs" } }) } }, "cn"),
    ).resolves.toMatchObject({ nav: { url: "/docs" } });
  });

  it("merges the site's props over the plugins' contributions, which set docs layout props", async () => {
    const options = layoutProps({
      ui: { layoutProps: { nav: { title: "Acme" }, links: [{ text: "Docs", url: "/docs" }] } },
      plugins: [
        {
          layoutProps: () => ({
            nav: { title: "Mintlify", transparentMode: "top" },
            links: [{ text: "Blog", url: "/blog" }],
          }),
        },
        {
          layoutProps: () => ({
            nav: { transparentMode: "always" },
            links: [{ text: "API", url: "/api" }],
            sidebar: { defaultOpenLevel: 1 },
          }),
        },
      ],
    });

    await expect(options).resolves.toEqual({
      nav: { title: "Acme", transparentMode: "top", url: "/" },
      links: [
        { text: "Docs", url: "/docs" },
        { text: "Blog", url: "/blog" },
        { text: "API", url: "/api" },
      ],
      sidebar: { defaultOpenLevel: 1 },
    });
  });

  it("gives the page to the hooks of a content page", async () => {
    const seen: (string | undefined)[] = [];
    const ctx = await createSite({
      ui: {
        layoutProps({ page }) {
          seen.push(page?.url);
          return {};
        },
      },
    });
    await ctx.getLayoutProps({ lang: undefined, page: await getPage(ctx, ["docs", "basics"]) });
    await ctx.getLayoutProps({ lang: undefined });

    expect(seen).toEqual(["/docs/basics", undefined]);
  });

  it("links the repository", async () => {
    const gitlab = { ...git, provider: "gitlab" as const };

    await expect(layoutProps({ site: { git } })).resolves.toMatchObject({
      githubUrl: "https://github.com/fuma-nama/fumapress",
    });
    const { links } = await layoutProps({
      site: { git: gitlab },
      ui: { layoutProps: { links: [{ text: "Blog", url: "/blog" }] } },
    });
    expect(links).toMatchObject([
      { text: "Blog", url: "/blog" },
      {
        type: "icon",
        label: "GitLab",
        url: "https://gitlab.com/fuma-nama/fumapress",
        external: true,
      },
    ]);
    await expect(
      layoutProps({
        site: { git: gitlab },
        ui: { layoutProps: { githubUrl: "https://github.com/fuma-nama/fumadocs" } },
      }),
    ).resolves.not.toHaveProperty("links");
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
  async function render(site: Partial<TestSite>, target: (ctx: Context) => Promise<RenderTarget>) {
    const ctx = await pressContext({ content: { files }, ...site });
    return ctx.renderPage(await target(ctx));
  }

  const basics = async (ctx: Context): Promise<RenderTarget> => ({
    lang: undefined,
    page: await getPage(ctx, ["docs", "basics"]),
  });

  const bodyWrapper = {
    name: "test:prose",
    region: "body-wrapper" as const,
    component: ({ children }: { children: string }) => children,
  };

  /** renders `docs/basics`, keeping the props of `ui.renderPage` */
  async function renderContent(plugin: SitePlugin, site: Partial<TestSite> = {}) {
    let props: DefaultPageProps | undefined;
    const node = await render(
      {
        ...site,
        plugins: [plugin],
        ui: {
          ...site.ui,
          renderPage(input: DefaultPageProps) {
            props = input;
            return input.renderDefault();
          },
        } satisfies PressConfig<AppShape, any>["ui"],
      },
      basics,
    );
    return { node, props };
  }

  it("builds the props of content pages: data, toc, body, slots and the props of the owner", async () => {
    const getPageLastModified = vi.fn(() => new Date(0));
    const { node, props } = await renderContent({
      getPageBody: () => ({ node: "body" }),
      getPageToc: () => [{ title: "Intro", url: "#intro", depth: 2 }],
      getPageLastModified,
      getPageView: () => ({ props: { post: { title: "Post" } }, node: "post" }),
      slots: ({ page }) =>
        page
          ? [{ name: "test:share", region: "actions", component: () => "share" }, bodyWrapper]
          : [
              { name: "test:sidebar", region: "sidebar-footer", component: () => "sidebar" },
              { name: "test:banner", region: "banner", component: () => "banner" },
            ],
    });

    expect(isValidElement(node) && node.type).toBe(HomeShell);
    expect(props).toMatchObject({
      type: undefined,
      slugs: ["docs", "basics"],
      pageData: { title: "docs/basics.mdx", lastModified: new Date(0) },
      toc: [{ title: "Intro", url: "#intro", depth: 2 }],
      post: { title: "Post" },
      layoutProps: { nav: { title: "Fumapress" } },
    });
    expect(getPageLastModified).toHaveBeenCalledOnce();
    expect(
      props && "body" in props && isValidElement(props.body) && isValidElement(props.children),
    ).toBe(true);
    // the site-wide items, then the built-in buttons, `core:markdown` only with a Markdown URL; the root renders `banner`
    expect(props?.slots).toMatchObject({
      "test:sidebar": { region: "sidebar-footer" },
      "core:view-options": { region: "actions" },
      "test:share": { region: "actions" },
    });
    expect(Object.keys(props?.slots ?? {})).toEqual([
      "test:sidebar",
      "core:view-options",
      "test:share",
    ]);
    expect(props?.layoutProps.tree.children.length).toBeGreaterThan(0);
  });

  it("gives `transformPage` the loaded last modified date of the rendered page", async () => {
    const { props } = await renderContent({
      getPageLastModified: () => new Date(0),
      transformPage: () => ({ lastModified: undefined }),
    });

    expect(props?.pageData.lastModified).toBeUndefined();
  });

  it("passes the options of `renderDefault()` to the Docs Layout and page", async () => {
    const options = {
      layoutProps: { tabs: false as const },
      pageProps: { breadcrumb: { enabled: false } },
    };
    const node = await render(
      { ui: { renderPage: (input: DefaultPageProps) => input.renderDefault(options) } },
      basics,
    );

    expect(isValidElement(node) && node.type).toBe(DefaultDocs);
    expect(isValidElement(node) && node.props).toMatchObject({ options });
  });

  it("gives the built-in UI the items of each region, without the actions row when empty", async () => {
    const element = (name: string) => () => name;
    const node = await render(
      {
        plugins: [
          {
            slots: ({ page }) =>
              page
                ? [
                    { name: "test:footer", region: "footer", component: element("footer") },
                    { name: "test:toc", region: "toc-footer", component: element("toc") },
                  ]
                : [{ name: "test:sidebar", region: "sidebar-banner", component: element("sb") }],
          },
        ],
        ui: {
          renderPage: (input: DefaultPageProps) => input.renderDefault({ layout: "notebook" }),
        },
      },
      basics,
    );
    const regions = (node as ReactElement<{ regions: Record<string, ReactNode> }>).props.regions;

    expect(node).toMatchObject({ props: { layout: "notebook" } });
    expect(Object.keys(regions).sort()).toEqual([
      "actions",
      "footer",
      "sidebar-banner",
      "toc-footer",
    ]);
  });

  it("types the options of `renderDefault()` by the layout and the page", () => {
    type Content = ContentPageProps<"docs", AppShape, PluginTypes>;
    const options: Parameters<Content["renderDefault"]>[0][] = [
      { layoutProps: { tabMode: "auto" } },
      { layout: "notebook", layoutProps: { tabMode: "navbar" } },
      // @ts-expect-error Spacious has no `tabMode`
      { layout: "spacious", layoutProps: { tabMode: "navbar" } },
    ];
    type View = ViewPageProps<never, AppShape, PluginTypes>;
    // @ts-expect-error plugin views take no options
    const view: Parameters<View["renderDefault"]>[0] = {};
    expect(options.length + Object.keys(view ?? {}).length).toBe(3);
  });

  it("gives each page its own React identity, so client state doesn't reach the next page", async () => {
    const { props } = await renderContent({
      getPageBody: () => ({ node: "body" }),
      getPageView: () => ({ props: {}, node: "post" }),
    });
    expect(props && "body" in props && isValidElement(props.body) && props.body.key).toBe(
      "/docs/basics",
    );
    expect(isValidElement(props?.children) && props.children.key).toBe("/docs/basics");
    expect(props?.slots["core:view-options"]?.element.key).toBe("/docs/basics core:view-options");

    const route: PageRoute = { path: "/show/[id]", render: "static", pages: [], data: {} };
    const node = (await render({}, async () => ({
      lang: undefined,
      view: { type: "show", props: {}, node: "view" },
      route,
      path: "/show/a",
    }))) as ReactElement<{ children: ReactNode }>;
    expect(isValidElement(node.props.children) && node.props.children.key).toBe("/show/a");
  });
});

it("redirects the forms of a path that middleware wouldn't recognize", async () => {
  const ctx = await pressContext({
    content: { docs: { files: [] } },
    plugins: [
      {
        middleware: (request, next) =>
          new URL(request.url).pathname.startsWith("/admin")
            ? Promise.resolve(new Response(null, { status: 401 }))
            : next(),
      },
    ],
  });
  const location = async (path: string) => {
    const response = await ctx.handleRequest(
      new Request(`https://site.example${path}`),
      async () => new Response("secret"),
    );
    return response.status === 308 ? response.headers.get("Location") : response.status;
  };

  expect(await location("//admin/x?a=1")).toBe("/admin/x?a=1");
  expect(await location("/%61dmin/x")).toBe("/admin/x");
  expect(await location("/admin/x")).toBe(401);
  expect(await location("/%e4%b8%ad/x")).toBe("/%E4%B8%AD/x");
  expect(await location("/a%21b")).toBe("/a!b");
  expect(await location("/x/")).toBe("/x");
  expect(await location("/x/index.html")).toBe("/x");
  // the escapes of paths that need them, and the root
  expect(await location("/docs/%E4%B8%AD/a%2Fb")).toBe(200);
  expect(await location("/")).toBe(200);
});

it("leaves the root outside of the base path to the router", async () => {
  const ctx = await pressContext({ content: { docs: { files: [] } } }, { base: "/base" });
  const response = await ctx.handleRequest(
    new Request("https://site.example/"),
    async () => new Response(null, { status: 404 }),
  );

  expect(response.status).toBe(404);
});

it("keeps the repeated tags of one list, like two site verifications", async () => {
  const verification = (content: string): HeadTag => ({
    tag: "meta",
    attrs: { name: "google-site-verification", content },
  });
  const ctx = await pressContext({
    content: { docs: { files: [] } },
    head: [verification("a"), verification("b")],
    plugins: [{ head: () => [verification("c")] }],
  });
  const head = await ctx.getHead({ lang: undefined });

  expect(head.filter((tag) => tag.attrs?.name === "google-site-verification")).toEqual([
    verification("a"),
    verification("b"),
  ]);
});
