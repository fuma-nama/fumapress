import type { VirtualFile } from "fumadocs-core/source";
import { describe, expect, it, vi } from "vitest";
import type { ApiRoute, PageRouteInput } from "@/routes";
import { i18n, page, pressContext, type TestSite } from "./harness";
import { llmsPlugin, type LLMsOptions } from "@/plugins/llms.txt";

const titled = (path: string) => page(path, { title: `Title of ${path}` });

/** `docs/basics` is translated, `docs/only-en` falls back to English in `cn`, `docs/empty` has no text */
const files = [
  titled("index.mdx"),
  titled("docs/basics.mdx"),
  titled("docs/basics.cn.mdx"),
  titled("docs/only-en.mdx"),
  titled("docs/empty.mdx"),
];
const content: TestSite["content"] = { files };
const dynamic: Partial<TestSite> = { content: { files: () => files } };

function createSite(
  config: Partial<TestSite> = {},
  options?: LLMsOptions,
  base = "/",
  plugins: TestSite["plugins"] = [],
) {
  return pressContext(
    {
      content,
      site: { baseUrl: "https://example.com" },
      ...config,
      plugins: [
        ...plugins,
        {
          getPageText: (page) =>
            page.path === "docs/empty.mdx" ? undefined : `Text of ${page.path}`,
        },
        llmsPlugin(options),
      ],
    },
    { base },
  );
}

function fetchRoute(routes: ApiRoute[], path: string) {
  const route = routes.find((item) => item.path === path);
  if (!route?.GET) throw new Error(`missing route ${path}`);
  return route.GET(request(path), { params: {} });
}

async function readRoute(routes: ApiRoute[], path: string) {
  return (await fetchRoute(routes, path)).text();
}

const accept = { headers: { Accept: "text/markdown" } };
const request = (path: string, init?: RequestInit) =>
  new Request(`https://example.com${path}`, init);

const html = vi.fn(
  async () => new Response("<html></html>", { headers: { "Content-Type": "text/html" } }),
);

describe("llmsPlugin", () => {
  it("generates a route per Markdown file", async () => {
    const ctx = await createSite({ i18n });
    const routes = await ctx.getApiRoutes();

    expect(routes.map((route) => route.path)).toEqual([
      "/llms.txt",
      "/llms-full.txt",
      "/en.md",
      "/en/docs/basics.md",
      "/en/docs/only-en.md",
      "/en/docs/empty.md",
      "/cn.md",
      "/cn/docs/basics.md",
      "/cn/docs/only-en.md",
      "/cn/docs/empty.md",
    ]);
    expect(routes.every((route) => route.render === "static")).toBe(true);

    const res = await fetchRoute(routes, "/cn/docs/basics.md");
    expect(res.headers.get("Content-Type")).toBe("text/markdown; charset=utf-8");
    await expect(res.text()).resolves.toBe(
      "# Title of docs/basics.cn.mdx (https://example.com/cn/docs/basics)\n\nText of docs/basics.cn.mdx",
    );
    await expect(readRoute(routes, "/en/docs/empty.md")).resolves.toBe("");
  });

  it("links pages to their Markdown in llms.txt and renders them in llms-full.txt without fallback pages", async () => {
    const routes = await (await createSite({ i18n })).getApiRoutes();
    const index = await readRoute(routes, "/llms.txt");
    const full = await readRoute(routes, "/llms-full.txt");

    expect(index).toContain("[Title of index.mdx](https://example.com/en.md)");
    expect(index).toContain("[Title of docs/basics.mdx](https://example.com/en/docs/basics.md)");
    expect(index).toContain("[Title of docs/basics.cn.mdx](https://example.com/cn/docs/basics.md)");
    expect(full.split("\n\n# ")).toHaveLength(4);
    expect(full).toContain("Text of docs/basics.cn.mdx");
    expect(full).not.toContain("/cn/docs/only-en)");
    expect(full).not.toContain("docs/empty.mdx");
  });

  it.each([
    ["`site.baseUrl`", { baseUrl: "https://example.com/repo" }, "https://example.com/repo"],
    ["the base path alone", {}, "/repo"],
  ])("links pages under the base path with %s", async (_, site, prefix) => {
    const routes = await (await createSite({ site }, {}, "/repo/")).getApiRoutes();

    const index = await readRoute(routes, "/llms.txt");
    expect(index).toContain(`[Title of docs/basics.mdx](${prefix}/docs/basics.md)`);
    expect(index).toContain(`[Title of index.mdx](${prefix}/index.md)`);
    await expect(readRoute(routes, "/llms-full.txt")).resolves.toContain(
      `# Title of docs/basics.mdx (${prefix}/docs/basics)`,
    );
  });

  it("serves Markdown from the middleware on a dynamic source", async () => {
    const ctx = await createSite(dynamic, {}, "/repo/");
    const routes = await ctx.getApiRoutes();

    expect(routes.map((route) => [route.path, route.render])).toEqual([
      ["/llms.txt", "dynamic"],
      ["/llms-full.txt", "dynamic"],
    ]);
    const serve = async (path: string) =>
      (await ctx.handleRequest(request(`/repo${path}`), html)).text();

    await expect(serve("/docs/basics.md")).resolves.toContain("Text of docs/basics.mdx");
    await expect(serve("/index.md")).resolves.toContain("Text of index.mdx");
    await expect(serve("/docs/empty.md")).resolves.toBe("");

    html.mockClear();
    for (const url of [
      "https://example.com/repo/docs/missing.md",
      "https://example.com/docs/basics.md",
    ]) {
      await ctx.handleRequest(new Request(url), html);
    }
    expect(html).toHaveBeenCalledTimes(2);
  });

  it("gives the Markdown of a page rendered on demand the `staleTime` of its source", async () => {
    const live = await createSite({ content: { files: () => files, staleTime: 120_000 } });
    const response = await live.handleRequest(request("/docs/basics.md"), html);
    expect(response.headers.get("Cache-Control")).toBe("public, s-maxage=120");

    const fresh = await createSite(dynamic);
    const uncached = await fresh.handleRequest(request("/docs/basics.md"), html);
    expect(uncached.headers.get("Cache-Control")).toBeNull();
  });

  it("serves the Markdown file to requests preferring it, caches key on `Accept`", async () => {
    const ctx = await createSite(dynamic, {}, "/repo/");
    const notFound = async () => new Response(null, { status: 404 });
    /** serves rewrites like a framework, other paths are HTML */
    const next = async (rewrite?: string) =>
      rewrite ? ctx.handleRequest(request(`/repo${rewrite}`), notFound) : html();

    const res = await ctx.handleRequest(request("/repo/docs/basics", accept), next);
    await expect(res.text()).resolves.toContain("Text of docs/basics.mdx");
    expect(res.headers.get("Vary")).toBe("Accept");
    expect(res.headers.get("Cache-Control")).toBe("private");

    for (const input of [request("/repo/blog", accept), request("/repo/docs/basics")]) {
      const rendered = await ctx.handleRequest(input, next);
      expect(rendered.headers.get("Content-Type")).toBe("text/html");
      expect(rendered.headers.get("Vary")).toBe("Accept");
    }

    // only HTML, and the headers of responses like `Response.redirect()` are immutable
    const redirect = Response.redirect("https://example.com/repo/docs/other", 307);
    const redirected = await ctx.handleRequest(request("/repo/docs/basics"), async () => redirect);
    expect(redirected).toBe(redirect);
  });

  it("leaves requests alone without `autoRedirect`, and other methods than GET", async () => {
    const ctx = await createSite({}, { autoRedirect: false });
    const res = await ctx.handleRequest(request("/docs/basics", accept), html);
    expect(res.headers.get("Vary")).toBeNull();

    const post = await (
      await createSite(dynamic)
    ).handleRequest(request("/docs/basics.md", { method: "POST" }), html);
    expect(post.headers.get("Content-Type")).toBe("text/html");
  });

  it("gives a static source files and a dynamic source the middleware, on one site", async () => {
    const ctx = await createSite({
      content: {
        docs: { files: [titled("docs/basics.mdx")] },
        live: { files: () => [titled("live/status.mdx")] },
      },
    });
    const routes = await ctx.getApiRoutes();

    expect(routes.map((route) => [route.path, route.render])).toEqual([
      ["/llms.txt", "dynamic"],
      ["/llms-full.txt", "dynamic"],
      ["/docs/basics.md", "static"],
    ]);
    await expect(readRoute(routes, "/docs/basics.md")).resolves.toContain(
      "Text of docs/basics.mdx",
    );

    html.mockClear();
    const live = await ctx.handleRequest(request("/live/status.md"), html);
    await expect(live.text()).resolves.toContain("Text of live/status.mdx");
    expect(html).not.toHaveBeenCalled();

    await ctx.handleRequest(request("/docs/basics.md"), html);
    expect(html).toHaveBeenCalledTimes(1);
  });

  it("links the Markdown of pages without the base path, the page actions of Fumadocs add it", async () => {
    const ctx = await createSite({}, {}, "/repo/");
    const loader = await ctx.getLoader();
    const data = async (url: string) => ctx.getPageData(loader.getPageByUrl(url)!);

    await expect(data("/docs/basics")).resolves.toMatchObject({
      markdownUrl: "/docs/basics.md",
    });
    await expect(data("/")).resolves.toMatchObject({ markdownUrl: "/index.md" });

    const page = loader.getPageByUrl("/docs/basics")!;
    await expect(ctx.getHead({ lang: page.locale, page })).resolves.toContainEqual({
      tag: "link",
      attrs: { rel: "alternate", type: "text/markdown", href: "/repo/docs/basics.md" },
    });
  });

  it("links the Markdown of content pages only, other pages have none", async () => {
    const ctx = await pressContext(
      { content, plugins: [llmsPlugin()] },
      { routes: [{ path: "/about", render: "static", markdown: async () => "# About" }] },
    );
    const [route] = await ctx.getPageRoutes();

    await expect(ctx.getPageData(route!, "/about")).resolves.not.toHaveProperty("markdownUrl");
  });

  it("accepts custom Markdown", async () => {
    const ctx = await createSite(
      {},
      {
        getLLMText(page) {
          return page.url === "/" ? undefined : `custom ${page.url}`;
        },
      },
    );
    const routes = await ctx.getApiRoutes();

    await expect(readRoute(routes, "/docs/empty.md")).resolves.toBe("custom /docs/empty");
    await expect(readRoute(routes, "/index.md")).resolves.toBe("");
  });
});

describe("sections", () => {
  /** `docs` is a root folder, `guides` is not; `docs/empty` has no text and `docs/hidden` is `noindex` */
  const sectioned: VirtualFile[] = [
    titled("index.mdx"),
    { type: "meta", path: "docs/meta.json", data: { title: "Docs", root: true } },
    titled("docs/index.mdx"),
    titled("docs/basics.mdx"),
    titled("docs/empty.mdx"),
    titled("docs/hidden.mdx"),
    titled("guides/intro.mdx"),
  ];
  const hidden: Partial<TestSite> = {
    plugins: [
      {
        transformPage: (_, { page }) => (page?.path === "docs/hidden.mdx" ? { noindex: true } : {}),
      },
    ],
  };
  const sectionSite = (config: Partial<TestSite> = {}, options?: LLMsOptions, base?: string) =>
    createSite(
      { content: { files: sectioned }, ...config, plugins: undefined },
      options,
      base,
      config.plugins,
    );

  it("gives root folders their own llms-full.txt, linked from llms.txt", async () => {
    const routes = await (await sectionSite(hidden)).getApiRoutes();

    expect(routes.map((route) => [route.path, route.render]).slice(0, 3)).toEqual([
      ["/llms.txt", "static"],
      ["/llms-full.txt", "static"],
      ["/docs/llms-full.txt", "static"],
    ]);
    expect(routes.some((route) => route.path === "/guides/llms-full.txt")).toBe(false);

    const index = await readRoute(routes, "/llms.txt");
    expect(index).toContain("- [Docs](https://example.com/docs/llms-full.txt)");
    expect(index).toContain("  - [Title of docs/basics.mdx](https://example.com/docs/basics.md)");

    const response = await fetchRoute(routes, "/docs/llms-full.txt");
    expect(response.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
    // pages without text or with `noindex` are left out, like in the root file
    await expect(response.text()).resolves.toBe(
      [
        "# Title of docs/index.mdx (https://example.com/docs)\n\nText of docs/index.mdx",
        "# Title of docs/basics.mdx (https://example.com/docs/basics)\n\nText of docs/basics.mdx",
      ].join("\n\n"),
    );
    const full = await readRoute(routes, "/llms-full.txt");
    expect(full).toContain("Text of guides/intro.mdx");
    expect(full).not.toContain("docs/hidden.mdx");
    expect(full).not.toContain("\n\n\n");
  });

  it("passes `filter` and `section` to Fumadocs", async () => {
    const ctx = await sectionSite(
      {},
      {
        filter: (page) => page.path !== "docs/basics.mdx",
        section: (folder) => (folder.root ? { collapse: true } : false),
      },
    );
    const routes = await ctx.getApiRoutes();
    const paths = routes.map((route) => route.path);

    expect(paths).toContain("/docs/llms.txt");
    expect(paths).not.toContain("/docs/basics.md");
    await expect(readRoute(routes, "/llms.txt")).resolves.toContain(
      "- [Docs](https://example.com/docs/llms.txt)",
    );
    // a page left out links to itself, and has no Markdown to link
    await expect(readRoute(routes, "/docs/llms.txt")).resolves.toContain(
      "[Title of docs/basics.mdx](https://example.com/docs/basics)",
    );
    const page = (await ctx.getLoader()).getPageByUrl("/docs/basics")!;
    await expect(ctx.getPageData(page)).resolves.not.toHaveProperty("markdownUrl");
  });

  it("serves the files of sections from the middleware on a dynamic source", async () => {
    const ctx = await sectionSite({ content: { files: () => sectioned } }, {}, "/repo/");
    const routes = await ctx.getApiRoutes();
    expect(routes.map((route) => [route.path, route.render])).toEqual([
      ["/llms.txt", "dynamic"],
      ["/llms-full.txt", "dynamic"],
    ]);

    html.mockClear();
    const response = await ctx.handleRequest(request("/repo/docs/llms-full.txt"), html);
    expect(response.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
    await expect(response.text()).resolves.toContain("Text of docs/basics.mdx");
    expect(html).not.toHaveBeenCalled();

    // not a section, and the root files have their routes
    for (const path of ["/guides/llms-full.txt", "/docs/llms.txt", "/llms.txt"])
      await ctx.handleRequest(request(`/repo${path}`), html);
    expect(html).toHaveBeenCalledTimes(3);
  });
});

describe('routes: "all"', () => {
  const allRoutes = (routes: PageRouteInput[], config: Partial<TestSite> = {}) =>
    pressContext({ content, ...config, plugins: [llmsPlugin({ routes: "all" })] }, { routes });

  it("serves the Markdown of page routes: prerendered for static ones, mirrored for dynamic ones", async () => {
    const markdown = vi.fn(async (path: string) => (path === "/blank" ? undefined : `# ${path}`));
    const own = (path: string, render: "static" | "dynamic") => ({ path, render, markdown });
    const ctx = await allRoutes([
      own("/about", "static"),
      own("/blank", "static"),
      own("/status", "dynamic"),
    ]);
    const routes = await ctx.getApiRoutes();

    await expect(readRoute(routes, "/about.md")).resolves.toBe("# /about");
    expect(routes.some((route) => route.path === "/blank.md")).toBe(false);
    // the page data links the Markdown of the pages that have one
    const markdownUrl = async (path: string) => {
      const route = (await ctx.getPageRoutes()).find((item) => item.path === path)!;
      return (await ctx.getPageData(route, path)).markdownUrl;
    };
    await expect(markdownUrl("/about")).resolves.toBe("/about.md");
    await expect(markdownUrl("/blank")).resolves.toBeUndefined();
    await expect(markdownUrl("/status")).resolves.toBe("/status.md");
    const mirror = routes.find((route) => route.path === "/_llms.txt/[...path]");
    expect(mirror?.render).toBe("dynamic");

    // `/status.md` misses its static route, the mirror renders it
    const next = vi.fn(async (rewrite?: string) =>
      rewrite === undefined
        ? new Response(null, { status: 404 })
        : mirror!.GET!(request(`${rewrite}`), { params: {} }),
    );
    const response = await ctx.handleRequest(request("/status.md"), next);
    await expect(response.text()).resolves.toBe("# /status");
    // a static page and the root have no mirror of their own
    for (const url of ["/about.md", "/index.md"])
      expect((await ctx.handleRequest(request(`${url}`), next)).status).toBe(404);
  });

  it.each([
    ["prefixed", i18n, "cn", "/status", "/_llms.txt/cn/[...path]", "/cn/status"],
    ["the root of a language", i18n, "cn", "/", "/_llms.txt/cn/[...path]", "/cn"],
    [
      "with a hidden default locale",
      { ...i18n, hideLocale: "default-locale" as const },
      "en",
      "/status",
      "/_llms.txt/en/[...path]",
      "/status",
    ],
  ])(
    "mirrors a page on demand under its language: %s",
    async (_, config, lang, path, mirrorPath, url) => {
      const markdown = async (path: string) => `# ${path}`;
      const ctx = await allRoutes(
        [
          { path, lang, render: "dynamic", markdown },
          { path: "/other", lang: "en", render: "dynamic", markdown },
        ],
        { i18n: config },
      );
      const mirrors: ApiRoute[] = [];
      for (const route of await ctx.getApiRoutes())
        if (route.path.startsWith("/_llms.txt")) mirrors.push(route);

      expect(mirrors.map((route) => route.path)).toContain(mirrorPath);
      const response = await ctx.handleRequest(request(`${url}.md`), async (rewrite) =>
        rewrite === undefined
          ? new Response(null, { status: 404 })
          : mirrors.find((route) => rewrite.startsWith(route.path.replace("/[...path]", "/")))!
              .GET!(request(rewrite), { params: {} }),
      );
      await expect(response.text()).resolves.toBe(`# ${url}`);
    },
  );

  it("serves the mirrors only through the `<page>.md` URLs, a rewrite re-enters the middleware", async () => {
    const ctx = await allRoutes([
      { path: "/admin/[x]", render: "dynamic", markdown: async () => "secret" },
    ]);
    const serve = async (url: string): Promise<Response> =>
      ctx.handleRequest(request(`${url}`), async (rewrite) =>
        rewrite === undefined
          ? url.startsWith("/_llms.txt")
            ? new Response("secret", { headers: { "Content-Type": "text/markdown" } })
            : new Response(null, { status: 404 })
          : serve(rewrite),
      );

    expect((await serve("/_llms.txt/admin/s.md")).status).toBe(404);
    expect((await serve("/_llms.txt")).status).toBe(404);
    await expect((await serve("/admin/s.md")).text()).resolves.toBe("secret");
    expect((await serve("/_llms.txt/admin/s.md")).status).toBe(404);
  });

  it("keeps the mirror closed while a rewrite is in flight", async () => {
    const ctx = await allRoutes([
      { path: "/admin/[x]", render: "dynamic", markdown: async () => "secret" },
    ]);
    const statuses: number[] = [];
    await ctx.handleRequest(request("/admin/s.md"), async (rewrite) => {
      if (rewrite === undefined) return new Response(null, { status: 404 });
      for (const method of ["GET", "HEAD"]) {
        const direct = await ctx.handleRequest(
          new Request(request("/_llms.txt/admin/s.md"), { method }),
          async () => new Response("secret"),
        );
        statuses.push(direct.status);
      }
      return new Response("secret");
    });

    expect(statuses).toEqual([404, 404]);
  });
});
