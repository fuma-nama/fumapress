import { existsSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isValidElement, lazy, type ReactElement, type ReactNode } from "react";
import { defineI18n } from "fumadocs-core/i18n";
import type { _Internal, PageData, VirtualFile } from "fumadocs-core/source";
import { createPressContext, type Context, type RuntimeContext } from "@/context";
import type { HeadTag } from "@/head";
import type { AppShape, Plugin, PresetEntry } from "@/plugin";
import {
  matchRoute,
  type ApiRoute,
  type PageRoute,
  type PageRouteInput,
  type ViewRoute,
} from "@/routes";
import type { DefaultPageProps, PressConfig, RenderTarget } from "@/press";
import { takumiPlugin } from "@/plugins/takumi";
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
  return ctx.getHead({ page: await getPage(ctx, slugs, lang) });
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
  it("fills the data from the page and plugins", async () => {
    const ctx = await createSite({
      i18n,
      site: { git },
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

  it("lets the site's option win over writers", async () => {
    const write = (name: string) => ({ name, configureLoader: () => ({ url: () => "/x" }) });
    const ctx = await createSite({
      loaderOptions: { url: () => "/site" },
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
    await expect(ctx.getHead({})).resolves.toEqual([defaultImage, icon, title("plugin")]);
  });

  it("keys the title and description of views over the ones of every page", async () => {
    const ctx = await createSite({ head: [title("Site"), meta("description", "A site")] });
    const route: PageRoute = { path: "/blog", render: "static", pages: [], options: {} };
    const head = await ctx.getHead({
      route,
      path: "/blog",
      view: { type: "blog.index", props: {}, node: null, title: "Blog", description: "Posts" },
    });

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
      options: {},
      pages: [{ path: "/cn/about", translations, params: {} }],
    };

    await expect(ctx.getHead({ route, path: "/cn/about" })).resolves.toEqual([
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

  it("is always dynamic on a runtime rendering on demand", async () => {
    const ctx = await createSite({ content: { docs: { files } } }, { dynamic: true });

    expect(ctx.getContentRender("docs")).toBe("dynamic");
    expect(ctx.getContentRender()).toBe("dynamic");
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
    await expect(renders({}, { dynamic: true })).resolves.toEqual(["static", "dynamic"]);
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
      "a capability",
      [
        { name: "x", provides: ["search"] },
        { name: "y", provides: ["search"] },
      ],
      '"x" and "y" both provide "search": a capability has one provider.',
    ],
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
      "a named slot item",
      ["a", "b"].map((name) => ({
        name,
        slots: () => [{ slot: "actions" as const, name: "share", component: () => null }],
      })),
      '"a" and "b" both add the "actions" item "share"',
      async (ctx) => ctx.getSlots({ page: await home(ctx) }),
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
    ["through the base options", "nav", (ctx) => ctx.getBaseOptions({ lang: undefined })],
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
                await site!.getBaseOptions({ lang: undefined }),
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
      loaderOptions: { alwaysRevalidate: true },
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
    ["adds none by default", plain, "/api/ai", "/api/ai"],
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

describe("getBaseOptions", () => {
  const baseOptions = async (config: Partial<TestSite>, lang?: string) =>
    (await createSite(config)).getBaseOptions({ lang });

  it("links the nav title to the home of the language", async () => {
    await expect(baseOptions({ i18n, site: { name: "Docs" } }, "cn")).resolves.toEqual({
      nav: { title: "Docs", url: "/cn" },
    });
    await expect(
      baseOptions({ i18n: { ...i18n, hideLocale: "default-locale" } }, "en"),
    ).resolves.toMatchObject({ nav: { url: "/" } });
    await expect(
      baseOptions({ i18n, ui: { baseOptions: () => ({ nav: { url: "/docs" } }) } }, "cn"),
    ).resolves.toMatchObject({ nav: { url: "/docs" } });
  });

  it("merges the site's options over the plugins' contributions", async () => {
    const options = baseOptions({
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

    await expect(options).resolves.toEqual({
      nav: { title: "Acme", transparentMode: "top", url: "/" },
      links: [
        { text: "Docs", url: "/docs" },
        { text: "Blog", url: "/blog" },
        { text: "API", url: "/api" },
      ],
    });
  });

  it("links the repository", async () => {
    const gitlab = { ...git, provider: "gitlab" as const };

    await expect(baseOptions({ site: { git } })).resolves.toMatchObject({
      githubUrl: "https://github.com/fuma-nama/fumapress",
    });
    const { links } = await baseOptions({
      site: { git: gitlab },
      ui: { baseOptions: { links: [{ text: "Blog", url: "/blog" }] } },
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
      baseOptions({
        site: { git: gitlab },
        ui: { baseOptions: { githubUrl: "https://github.com/fuma-nama/fumadocs" } },
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

  const bodyWrapper = {
    slot: "body.wrapper" as const,
    component: ({ children }: { children: string }) => children,
  };

  /** renders `docs/basics`, keeping the props of `ui.renderPage` */
  async function renderContent(plugin: SitePlugin) {
    let props: DefaultPageProps | undefined;
    const node = await render(
      {
        plugins: [plugin],
        ui: {
          renderPage(input: DefaultPageProps) {
            props = input;
            return input.renderDefault();
          },
        } satisfies PressConfig<AppShape, any>["ui"],
      },
      async (ctx) => ({ lang: undefined, page: await getPage(ctx, ["docs", "basics"]) }),
    );
    return { node, props };
  }

  it("builds the props of content pages: data, body, named slots and the props of the owner", async () => {
    const { node, props } = await renderContent({
      getPageBody: () => ({ node: "body" }),
      getPageView: () => ({ props: { post: { title: "Post" } }, node: "post" }),
      slots: ({ page }) =>
        page && [{ slot: "actions", name: "share", component: () => "share" }, bodyWrapper],
    });

    expect(isValidElement(node) && node.type).toBe(HomeShell);
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

  it("gives each page its own React identity, so client state doesn't reach the next page", async () => {
    const { props } = await renderContent({
      getPageBody: () => ({ node: "body" }),
      getPageView: () => ({ props: {}, node: "post" }),
    });
    expect(props && "body" in props && isValidElement(props.body) && props.body.key).toBe(
      "/docs/basics",
    );
    expect(isValidElement(props?.children) && props.children.key).toBe("/docs/basics");

    const node = (await render({}, async () => ({
      lang: undefined,
      view: { type: "show", props: {}, node: "view" },
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
