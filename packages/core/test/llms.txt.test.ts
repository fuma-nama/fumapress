import { describe, expect, it, vi } from "vitest";
import type { ApiRoute } from "fumadocs-core/framework/plugin";
import type { I18nConfig } from "fumadocs-core/i18n";
import type { VirtualFile } from "fumadocs-core/source";
import { createPress, type PressConfig } from "@/context";
import { llmsPlugin, type LLMsOptions } from "@/plugins/llms.txt";

const i18n: I18nConfig = { languages: ["en", "cn"], defaultLanguage: "en" };

function page(path: string): VirtualFile {
  return { type: "page", path, data: { title: `Title of ${path}` } };
}

/** `docs/basics` is translated, `docs/only-en` falls back to English in `cn`, `docs/empty` has no text */
const content: PressConfig["content"] = {
  files: [
    page("index.mdx"),
    page("docs/basics.mdx"),
    page("docs/basics.cn.mdx"),
    page("docs/only-en.mdx"),
    page("docs/empty.mdx"),
  ],
};

function createSite(config: Partial<PressConfig> = {}, options?: LLMsOptions, base = "/") {
  return createPress(
    {
      content,
      preset: false,
      site: { baseUrl: "https://example.com" },
      ...config,
      plugins: [
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
  return route.GET(new Request(`https://example.com${path}`), { params: {} });
}

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
      "# Title of docs/basics.cn.mdx (/cn/docs/basics)\n\nText of docs/basics.cn.mdx",
    );
    await expect((await fetchRoute(routes, "/en/docs/empty.md")).text()).resolves.toBe("");
  });

  it("names the root file `/index.md`", async () => {
    const routes = await (await createSite()).getApiRoutes();

    expect(routes.map((route) => route.path)).toContain("/index.md");
    await expect((await fetchRoute(routes, "/index.md")).text()).resolves.toContain(
      "Text of index.mdx",
    );
  });

  it("lists pages in llms.txt and renders them in llms-full.txt without fallback pages", async () => {
    const routes = await (await createSite({ i18n })).getApiRoutes();
    const index = await (await fetchRoute(routes, "/llms.txt")).text();
    const full = await (await fetchRoute(routes, "/llms-full.txt")).text();

    expect(index).toContain("[Title of docs/basics.mdx](/en/docs/basics)");
    expect(index).toContain("[Title of docs/basics.cn.mdx](/cn/docs/basics)");
    expect(full.split("\n\n# ")).toHaveLength(4);
    expect(full).toContain("Text of docs/basics.cn.mdx");
    expect(full).not.toContain("(/cn/docs/only-en)");
    expect(full).not.toContain("docs/empty.mdx");
  });

  it("serves Markdown from the middleware in dynamic mode", async () => {
    const ctx = await createSite({ mode: "dynamic" }, {}, "/repo/");
    const routes = await ctx.getApiRoutes();

    expect(routes.map((route) => [route.path, route.render])).toEqual([
      ["/llms.txt", "dynamic"],
      ["/llms-full.txt", "dynamic"],
    ]);
    const md = await ctx.handleRequest(
      new Request("https://example.com/repo/docs/basics.md"),
      html,
    );
    await expect(md.text()).resolves.toContain("Text of docs/basics.mdx");
    const root = await ctx.handleRequest(new Request("https://example.com/repo/index.md"), html);
    await expect(root.text()).resolves.toContain("Text of index.mdx");

    const empty = await ctx.handleRequest(
      new Request("https://example.com/repo/docs/empty.md"),
      html,
    );
    await expect(empty.text()).resolves.toBe("");

    html.mockClear();
    for (const url of [
      "https://example.com/repo/docs/missing.md",
      "https://example.com/docs/basics.md",
    ]) {
      await ctx.handleRequest(new Request(url), html);
    }
    expect(html).toHaveBeenCalledTimes(2);
  });

  it("serves the Markdown file to requests preferring it, caches key on `Accept`", async () => {
    const ctx = await createSite({ mode: "dynamic" }, {}, "/repo/");
    const notFound = async () => new Response(null, { status: 404 });
    /** serves rewrites like a framework, other paths are HTML */
    const next = async (rewrite?: string) =>
      rewrite
        ? ctx.handleRequest(new Request(`https://example.com/repo${rewrite}`), notFound)
        : html();
    const accept = { headers: { Accept: "text/markdown" } };

    const res = await ctx.handleRequest(
      new Request("https://example.com/repo/docs/basics/", accept),
      next,
    );
    await expect(res.text()).resolves.toContain("Text of docs/basics.mdx");
    expect(res.headers.get("Vary")).toBe("Accept");
    expect(res.headers.get("Cache-Control")).toBe("private");

    for (const request of [
      new Request("https://example.com/repo/blog", accept),
      new Request("https://example.com/repo/docs/basics"),
    ]) {
      const rendered = await ctx.handleRequest(request, next);
      expect(rendered.headers.get("Content-Type")).toBe("text/html");
      expect(rendered.headers.get("Vary")).toBe("Accept");
    }

    // only HTML, and the headers of responses like `Response.redirect()` are immutable
    const redirect = Response.redirect("https://example.com/repo/docs/other", 307);
    const redirected = await ctx.handleRequest(
      new Request("https://example.com/repo/docs/basics"),
      async () => redirect,
    );
    expect(redirected).toBe(redirect);
  });

  it("leaves requests alone in static mode and without `autoRedirect`", async () => {
    const accept = { headers: { Accept: "text/markdown" } };
    const sites = [
      await createSite({ mode: "static" }),
      await createSite({}, { autoRedirect: false }),
    ];
    for (const ctx of sites) {
      const res = await ctx.handleRequest(
        new Request("https://example.com/docs/basics", accept),
        html,
      );
      expect(res.headers.get("Vary")).toBeNull();
    }

    const post = await (
      await createSite({ mode: "dynamic" })
    ).handleRequest(new Request("https://example.com/docs/basics.md", { method: "POST" }), html);
    expect(post.headers.get("Content-Type")).toBe("text/html");
  });

  it("links the Markdown of pages", async () => {
    const ctx = await createSite({}, {}, "/repo/");
    const loader = await ctx.getLoader();
    const data = async (url: string) => ctx.getPageData(loader.getPageByUrl(url)!);

    await expect(data("/docs/basics")).resolves.toMatchObject({
      markdownUrl: "/repo/docs/basics.md",
    });
    await expect(data("/")).resolves.toMatchObject({ markdownUrl: "/repo/index.md" });
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

    await expect((await fetchRoute(routes, "/docs/empty.md")).text()).resolves.toBe(
      "custom /docs/empty",
    );
    await expect((await fetchRoute(routes, "/index.md")).text()).resolves.toBe("");
  });
});
