import { existsSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineI18n, type I18nConfig } from "fumadocs-core/i18n";
import type { PageData, VirtualFile } from "fumadocs-core/source";
import {
  createPress,
  type Context,
  type InferAppShape,
  type PressConfig,
  type PressRuntime,
} from "@/context";
import type { Plugin } from "@/plugin";

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
const content = {
  files: [
    page("index.mdx"),
    page("docs/basics.mdx"),
    page("docs/basics.cn.mdx"),
    page("docs/only-en.mdx"),
    page("docs/shared.$.mdx"),
  ],
} satisfies PressConfig["content"];

function createSite(
  config: Partial<PressConfig> = {},
  runtime: Partial<PressRuntime<InferAppShape>> = {},
) {
  return createPress(
    {
      content,
      preset: false,
      ...config,
      site: { baseUrl: "https://example.com", ...config.site },
    },
    { base: "/", ...runtime },
  );
}

async function getPage(ctx: Context<InferAppShape>, slugs: string[], lang?: string) {
  const page = (await ctx.getLoader()).getPage(slugs, lang);
  if (!page) throw new Error(`missing page ${slugs.join("/")} (${lang})`);
  return page;
}

function GET() {
  return new Response("ok");
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createPress", () => {
  it("runs init, configureLoader and configure in order", async () => {
    const calls: string[] = [];
    const ctx = await createSite({
      i18n,
      plugins: [
        {
          init() {
            calls.push("a:init");
            expect(() => this.getLoader()).toThrow("the content loader is created after");
          },
          configureLoader(options) {
            calls.push("a:configureLoader");
            expect(options).toMatchObject({ baseUrl: "/", i18n });
            return { ...options, url: (slugs, locale) => `/${locale}/v2/${slugs.join("/")}` };
          },
          configure() {
            calls.push("a:configure");
          },
        },
        {
          init() {
            calls.push("b:init");
          },
          configureLoader(options) {
            calls.push("b:configureLoader");
            expect(options.url).toBeDefined();
            return options;
          },
          async configure() {
            calls.push("b:configure");
            expect((await this.getLoader()).getPages("en")).toHaveLength(4);
          },
        },
      ],
    });

    expect(calls).toEqual([
      "a:init",
      "b:init",
      "a:configureLoader",
      "b:configureLoader",
      "a:configure",
      "b:configure",
    ]);
    expect((await getPage(ctx, ["docs", "basics"], "cn")).url).toBe("/cn/v2/docs/basics");
  });

  it("loads the plugins of the preset unless it is disabled", async () => {
    const orama = vi.fn(() => ({ name: "orama-search", provides: ["search"] }));
    const preset = vi.fn(() => [
      { name: "sitemap", load: () => ({ name: "sitemap" }) },
      { name: "orama-search", provides: ["search"], load: orama },
    ]);
    const ctx = await createSite(
      { preset: "recommended", plugins: [{ name: "flexsearch", provides: ["search"] }] },
      { preset },
    );

    expect(ctx.plugins.map((plugin) => plugin.name)).toEqual(["flexsearch", "sitemap"]);
    expect(orama).not.toHaveBeenCalled();
    expect(ctx.getPlugin("sitemap")).toBe(ctx.plugins[1]);
    expect(ctx.getProvider("search")).toBe(ctx.plugins[0]);
    expect(ctx.getProvider("og-image")).toBeUndefined();

    preset.mockClear();
    await createSite({}, { preset });
    expect(preset).not.toHaveBeenCalled();
  });

  it('rejects `hideLocale: "always"`', async () => {
    await expect(createSite({ i18n: { ...i18n, hideLocale: "always" } })).rejects.toThrow(
      '`hideLocale: "always"` is not supported',
    );
  });

  it("reads the i18n config of translations, with the keys of plugins", async () => {
    const translations = defineI18n(i18n).translations();
    const ctx = await createSite({ translations, plugins: [{ translations: { keys: ["Copy"] } }] });
    translations.add({ en: { Copy: "Copy", Unknown: "Unknown" } });

    expect(ctx.translationsConfig).toBe(translations);
    expect(ctx.i18nConfig).toBe(i18n);
    expect(translations.get("en")).toEqual({ Copy: "Copy" });
    expect((await createSite({ i18n })).translationsConfig).toBeUndefined();
  });

  it("revalidates dynamic sources", async () => {
    let files = [page("index.mdx")];
    const ctx = await createSite({ content: { files: () => files } });
    const always = await createSite({
      content: { files: () => files },
      loaderOptions: { alwaysRevalidate: true },
    });
    expect((await ctx.getLoader()).getPages()).toHaveLength(1);
    expect((await always.getLoader()).getPages()).toHaveLength(1);
    files = [page("index.mdx"), page("other.mdx")];

    expect((await ctx.getLoader()).getPages()).toHaveLength(1);
    await ctx.revalidateLoader();
    expect((await ctx.getLoader()).getPages()).toHaveLength(2);
    expect((await always.getLoader()).getPages()).toHaveLength(2);
  });
});

describe("page hooks", () => {
  it("resolve to the first value of plugins", async () => {
    const ctx = await createSite({
      plugins: [
        { getPageText: () => undefined },
        {
          getPageText(page) {
            return `${page.path} of ${this.siteConfig.name}`;
          },
        },
        { getPageText: () => "last" },
      ],
    });
    const page = await getPage(ctx, []);

    await expect(ctx.getPageText(page)).resolves.toBe("index.mdx of Fumapress");
    await expect(ctx.getPageBody(page)).resolves.toBeUndefined();
  });

  it("collect slots by name, sorted by order", async () => {
    const [A, B, C] = [() => null, () => null, () => null];
    const ctx = await createSite({
      plugins: [
        {
          slots: () => [
            { slot: "page.footer", component: A, order: 1 },
            { slot: "page.actions", component: B },
          ],
        },
        { slots: ({ page }) => [{ slot: "page.footer", component: C, props: { url: page?.url } }] },
        {},
      ],
    });

    await expect(ctx.getSlots({ page: await getPage(ctx, []) })).resolves.toEqual({
      "page.footer": [
        { slot: "page.footer", component: C, props: { url: "/" } },
        { slot: "page.footer", component: A, order: 1 },
      ],
      "page.actions": [{ slot: "page.actions", component: B }],
    });
  });

  it("collect slots without a page, for the layout of every page", async () => {
    const Banner = () => null;
    const slots = vi.fn<NonNullable<Plugin["slots"]>>(({ page }) =>
      page ? [] : [{ slot: "layout.wrapper", component: Banner }],
    );
    const ctx = await createSite({ plugins: [{ slots }] });

    await expect(ctx.getSlots({})).resolves.toEqual({
      "layout.wrapper": [{ slot: "layout.wrapper", component: Banner }],
    });
    expect(slots).toHaveBeenCalledWith({});
  });

  it("resolve the view of a content page to the first plugin rendering it", async () => {
    const ctx = await createSite({
      plugins: [
        { getPageView: (page) => (page.path === "index.mdx" ? undefined : { node: "post" }) },
        { getPageView: () => ({ node: "other" }) },
      ],
    });

    await expect(ctx.getPageView(await getPage(ctx, ["docs", "basics"]))).resolves.toEqual({
      node: "post",
    });
    await expect(ctx.getPageView(await getPage(ctx, []))).resolves.toEqual({ node: "other" });
    await expect((await createSite()).getPageView(await getPage(ctx, []))).resolves.toBeUndefined();
  });
});

describe("getPageData", () => {
  it("fills the data from the page and plugins", async () => {
    const toc = [{ title: "Intro", url: "#intro", depth: 2 }];
    const lastModified = new Date("2026-01-01");
    const ctx = await createSite({
      site: { git: { user: "fuma-nama", repo: "fumapress", branch: "main", rootDir: "/repo" } },
      plugins: [{ getPageToc: () => toc, getPageLastModified: () => lastModified }],
    });

    await expect(ctx.getPageData(await getPage(ctx, ["docs", "basics"]))).resolves.toEqual({
      title: "docs/basics.mdx",
      description: "About docs/basics.mdx",
      url: "/docs/basics",
      path: "docs/basics.mdx",
      toc,
      lastModified,
      githubUrl: "https://github.com/fuma-nama/fumapress/blob/main/content/docs/basics.mdx",
    });
  });

  it("falls back to the last slug and reads a boolean `full`", async () => {
    const ctx = await createSite({
      content: {
        files: [
          page("docs/intro.mdx", { title: undefined, full: true }),
          page("docs/other.mdx", { full: "yes" }),
        ],
      },
    });

    await expect(ctx.getPageData(await getPage(ctx, ["docs", "intro"]))).resolves.toMatchObject({
      title: "intro",
      full: true,
      toc: [],
    });
    expect((await ctx.getPageData(await getPage(ctx, ["docs", "other"]))).full).toBeUndefined();
  });

  it("transforms the data in plugin order", async () => {
    const ctx = await createSite({
      plugins: [
        {
          enforce: "post",
          transformPage: (data) => ({ ...data, githubUrl: `${data.markdownUrl}.txt` }),
        },
        { transformPage: (data, page) => ({ ...data, markdownUrl: `${page.url}.md` }) },
      ],
    });

    await expect(ctx.getPageData(await getPage(ctx, ["docs", "basics"]))).resolves.toMatchObject({
      markdownUrl: "/docs/basics.md",
      githubUrl: "/docs/basics.md.txt",
    });
  });
});

describe("getHead", () => {
  const head: Partial<PressConfig> = {
    head: () => [{ tag: "meta", attrs: { name: "config" } }],
    plugins: [
      {
        head: ({ page }) => [{ tag: "meta", attrs: { name: "plugin", content: page?.url ?? "" } }],
      },
    ],
  };

  it("returns the tags of config and plugins without page", async () => {
    const ctx = await createSite(head);

    await expect(ctx.getHead({})).resolves.toEqual([
      { tag: "meta", attrs: { name: "config" } },
      { tag: "meta", attrs: { name: "plugin", content: "" } },
    ]);
  });

  it("passes the page to config and plugins", async () => {
    const ctx = await createSite(head);

    await expect(ctx.getHead({ page: await getPage(ctx, ["docs", "basics"]) })).resolves.toEqual([
      { tag: "meta", attrs: { name: "config" } },
      { tag: "meta", attrs: { name: "plugin", content: "/docs/basics" } },
    ]);
  });
});

describe("getPageHead", () => {
  it("returns the defaults of content pages", async () => {
    const ctx = await createSite({ i18n, site: { hreflang: { cn: "zh-Hans" } } });

    await expect(ctx.getPageHead(await getPage(ctx, ["docs", "basics"], "en"))).resolves.toEqual([
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
      const tags = await ctx.getPageHead(await getPage(ctx, slugs, "cn"));
      expect(tags).toContainEqual({ tag: "meta", attrs: { name: "robots", content: "noindex" } });
      expect(tags).toContainEqual({
        tag: "link",
        attrs: { rel: "canonical", href: `https://example.com/en/${slugs.join("/")}` },
      });
      expect(tags.some((tag) => tag.attrs?.rel === "alternate")).toBe(false);
    }

    const translated = await ctx.getPageHead(await getPage(ctx, ["docs", "basics"], "cn"));
    expect(translated).not.toContainEqual({
      tag: "meta",
      attrs: { name: "robots", content: "noindex" },
    });
  });

  it("marks fallback pages of sources without an absolute path", async () => {
    const files: VirtualFile[] = [];
    for (const file of content.files) files.push({ ...file, absolutePath: undefined });
    const ctx = await createSite({ i18n, content: { files } });
    const fallback = await ctx.getPageHead(await getPage(ctx, ["docs", "only-en"], "cn"));
    const translated = await ctx.getPageHead(await getPage(ctx, ["docs", "basics"], "cn"));
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
    const tags = await ctx.getPageHead(await getPage(ctx, ["docs", "basics"]));

    expect(
      tags.some((tag) => tag.attrs?.rel === "canonical" || tag.attrs?.property === "og:url"),
    ).toBe(false);
  });
});

describe("getApiRoutes", () => {
  it("fills render from the mode", async () => {
    const config: Partial<PressConfig> = {
      plugins: [
        {
          routes: () => [
            { path: "/a", GET },
            { path: "/b", GET, render: "dynamic" },
          ],
        },
      ],
    };
    const renders = async (mode?: PressConfig["mode"]) =>
      (await (await createSite({ ...config, mode })).getApiRoutes()).map((route) => route.render);

    await expect(renders()).resolves.toEqual(["static", "dynamic"]);
    await expect(renders("static")).resolves.toEqual(["static", "dynamic"]);
    await expect(renders("dynamic")).resolves.toEqual(["dynamic", "dynamic"]);
  });

  it("rejects static routes with handlers other than GET", async () => {
    const post = await createSite({
      plugins: [{ routes: () => [{ path: "/api", GET, POST: GET }] }],
    });
    const all = await createSite({ plugins: [{ routes: () => [{ path: "/api", ALL: GET }] }] });

    await expect(post.getApiRoutes()).rejects.toThrow(
      'the static route "/api" is generated from its GET handler, its POST handler needs',
    );
    await expect(all.getApiRoutes()).rejects.toThrow("its ALL handler needs");
  });

  it("rejects static routes with params but no `staticPaths`", async () => {
    const missing = await createSite({
      plugins: [{ routes: () => [{ path: "/og/[...slugs]", GET }] }],
    });
    const listed = await createSite({
      plugins: [{ routes: () => [{ path: "/og/[...slugs]", GET, staticPaths: [["a"]] }] }],
    });

    await expect(missing.getApiRoutes()).rejects.toThrow(
      'the static route "/og/[...slugs]" has params',
    );
    await expect(listed.getApiRoutes()).resolves.toHaveLength(1);
  });

  it("rejects two routes handling a method of one path", async () => {
    const routes = (...items: { POST?: typeof GET; GET?: typeof GET; ALL?: typeof GET }[]) =>
      createSite({
        mode: "dynamic",
        plugins: items.map((item) => ({ routes: () => [{ path: "/api", ...item }] })),
      });

    await expect((await routes({ GET }, { GET })).getApiRoutes()).rejects.toThrow(
      'two routes handle GET requests to "/api"',
    );
    await expect((await routes({ GET }, { ALL: GET })).getApiRoutes()).rejects.toThrow(
      'two routes handle GET requests to "/api"',
    );
    await expect((await routes({ GET }, { POST: GET })).getApiRoutes()).resolves.toHaveLength(2);
  });
});

describe("getViewRoutes", () => {
  const view = () => ({ node: "view" });

  it("keeps the routes rendering a view out of the API routes", async () => {
    const ctx = await createSite({
      plugins: [
        {
          routes: () => [
            { path: "/blog", lang: "en", view },
            { path: "/blog/[tag]", staticPaths: ["react"], view },
            { path: "/live", render: "dynamic", view },
            { path: "/feed.xml", GET },
          ],
        },
      ],
    });

    expect((await ctx.getApiRoutes()).map((route) => route.path)).toEqual(["/feed.xml"]);
    await expect(ctx.getViewRoutes()).resolves.toEqual([
      { path: "/blog", lang: "en", view, render: "static" },
      { path: "/blog/[tag]", staticPaths: ["react"], view, render: "static" },
      { path: "/live", render: "dynamic", view },
    ]);
  });

  it("rejects static views with params but no `staticPaths`", async () => {
    const ctx = await createSite({ plugins: [{ routes: () => [{ path: "/blog/[tag]", view }] }] });

    await expect(ctx.getViewRoutes()).rejects.toThrow('the static route "/blog/[tag]" has params');
  });

  it("creates the routes of plugins once per content", async () => {
    let files = [page("index.mdx")];
    const routes = vi.fn(() => [{ path: "/blog", view }]);
    const ctx = await createSite({ content: { files: () => files }, plugins: [{ routes }] });

    await ctx.getApiRoutes();
    await ctx.getViewRoutes();
    expect(routes).toHaveBeenCalledTimes(1);

    files = [page("index.mdx"), page("other.mdx")];
    await ctx.revalidateLoader();
    await ctx.getViewRoutes();
    expect(routes).toHaveBeenCalledTimes(2);
  });
});

describe("handleRequest", () => {
  it("runs middleware in order and passes rewrites on", async () => {
    const seen: string[] = [];
    const ctx = await createSite(
      {
        plugins: [
          {
            middleware(request, next) {
              seen.push(new URL(request.url).pathname);
              return next("/docs.md");
            },
          },
          {},
          {
            async middleware(request, next) {
              seen.push(`${new URL(request.url).pathname} ${request.headers.get("accept")}`);
              const response = await next();
              response.headers.set("x-plugin", "yes");
              return response;
            },
          },
        ],
      },
      { base: "/repo/" },
    );
    const next = vi.fn(async (rewrite?: string) => new Response(rewrite));
    const response = await ctx.handleRequest(
      new Request("https://example.com/repo/docs", { headers: { accept: "text/markdown" } }),
      next,
    );

    expect(seen).toEqual(["/repo/docs", "/repo/docs.md text/markdown"]);
    expect(next).toHaveBeenCalledExactlyOnceWith("/docs.md");
    await expect(response.text()).resolves.toBe("/docs.md");
    expect(response.headers.get("x-plugin")).toBe("yes");
  });

  it("returns the response of a middleware without the next ones", async () => {
    const ctx = await createSite({
      plugins: [
        { middleware: async () => new Response("plugin") },
        { middleware: async () => GET() },
      ],
    });
    const next = vi.fn(async () => GET());
    const response = await ctx.handleRequest(new Request("https://example.com/"), next);

    await expect(response.text()).resolves.toBe("plugin");
    expect(next).not.toHaveBeenCalled();
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
    expect(await ctx.getPageHead(page)).toContainEqual({
      tag: "link",
      attrs: { rel: "canonical", href: "https://example.com/en/docs/basics/" },
    });
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
    const fileUrl = async (site: PressConfig["site"], file = "/repo/content/index.mdx") =>
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

describe("defaultLayoutProps", () => {
  it("links the nav title to the home of the language", async () => {
    const ctx = await createSite({ i18n, site: { name: "Docs" } });
    const hidden = await createSite({ i18n: { ...i18n, hideLocale: "default-locale" } });
    const custom = await createSite({
      i18n,
      defaultLayoutProps: () => ({ nav: { url: "/docs" } }),
    });

    await expect(ctx.defaultLayoutProps({ lang: "cn" })).resolves.toEqual({
      nav: { title: "Docs", url: "/cn" },
    });
    await expect(hidden.defaultLayoutProps({ lang: "en" })).resolves.toMatchObject({
      nav: { url: "/" },
    });
    await expect(custom.defaultLayoutProps({ lang: "cn" })).resolves.toMatchObject({
      nav: { url: "/docs" },
    });
  });

  it("links the repository", async () => {
    const git = { user: "fuma-nama", repo: "fumapress", branch: "dev", rootDir: "/repo" };
    const github = await createSite({ site: { git } });
    const gitlab = await createSite({
      site: { git: { ...git, provider: "gitlab" } },
      defaultLayoutProps: { links: [{ text: "Blog", url: "/blog" }] },
    });
    const custom = await createSite({
      site: { git: { ...git, provider: "gitlab" } },
      defaultLayoutProps: { githubUrl: "https://github.com/fuma-nama/fumadocs" },
    });

    await expect(github.defaultLayoutProps({ lang: undefined })).resolves.toMatchObject({
      githubUrl: "https://github.com/fuma-nama/fumapress",
    });
    const { links } = await gitlab.defaultLayoutProps({ lang: undefined });
    expect(links).toMatchObject([
      { text: "Blog", url: "/blog" },
      {
        type: "icon",
        label: "GitLab",
        url: "https://gitlab.com/fuma-nama/fumapress",
        external: true,
      },
    ]);
    await expect(custom.defaultLayoutProps({ lang: undefined })).resolves.not.toHaveProperty(
      "links",
    );
  });
});
