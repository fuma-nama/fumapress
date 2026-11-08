import { afterEach, describe, expect, it, vi } from "vitest";
import type { Plugin } from "@fumapress/core";
import { createPress } from "@/config";
import type { TestSite } from "./harness";

type AstroValues = typeof import("virtual:fumapress/astro");

/** the runtime with the site, and the values of the integration */
async function load(config: Partial<TestSite>, astro: Partial<AstroValues> = {}) {
  vi.resetModules();
  vi.doMock("virtual:fumapress/config", async () => ({
    default: (await import("./harness")).testPress({ content: {}, ...config }),
  }));
  vi.doMock("virtual:fumapress/astro", () => ({
    adapter: false,
    serverOutput: false,
    routes: [],
    prerender: false,
    siteUrl: undefined,
    ...astro,
  }));
  vi.doMock("astro:config/client", () => ({ trailingSlash: "ignore" }));
  vi.doMock("@/plugins/content-source", () => ({
    contentSourcePlugin: () => ({ name: "fumapress" }),
  }));
  return import("@/runtime");
}

const build: Plugin = { build() {} };
const home = { type: "page" as const, path: "index.mdx", data: { title: "Home" } };
const view = (path: string, type: string, lang?: string) => ({
  lang,
  path,
  view: () => ({ type, props: {}, node: "" }),
});

afterEach(() => {
  globalThis.FUMAPRESS_BUILD = undefined;
});

it("renders content on demand with `output: 'server'`", async () => {
  const content = { docs: { files: [home] } };

  expect((await load({ content })).getPressContext().getContentRender("docs")).toBe("static");
  expect(
    (await load({ content }, { adapter: true, serverOutput: true }))
      .getPressContext()
      .getContentRender("docs"),
  ).toBe("dynamic");
});

it("lets `mode` decide over `output: 'server'`, and prerender a dynamic source without an adapter", async () => {
  const content = { docs: { files: [home] }, live: { files: () => [home] } };
  const server = await load(
    { content, mode: { docs: "force-static" } },
    { adapter: true, serverOutput: true },
  );
  expect(server.getPressContext().getContentRender("docs")).toBe("static");
  expect(server.getPressContext().getContentRender("live")).toBe("dynamic");

  const built = await load({ content, mode: "force-static" });
  expect(built.getPressContext().getContentRender()).toBe("static");
});

it("warns that the middleware of plugins never runs on a build without an adapter", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const guard: Plugin = { name: "guard", middleware: (_, next) => next() };
  await load({ plugins: [guard] }, { prerender: true });
  await load({ plugins: [guard] }, { prerender: true, adapter: true });
  await load({ plugins: [guard] });
  expect(warn.mock.calls).toEqual([
    [expect.stringContaining('the `middleware` of "guard" never runs')],
  ]);
  warn.mockRestore();
});

it("has the URL of the Astro config", async () => {
  const { getPressContext } = await load(
    { site: { name: "Site" } },
    { siteUrl: "https://example.com/docs" },
  );
  expect(getPressContext().siteConfig).toMatchObject({
    name: "Site",
    baseUrl: "https://example.com/docs",
  });

  createPress({ files: [] })
    .plugins()
    .config({
      // @ts-expect-error Astro gives the URL
      site: { baseUrl: "https://example.com" },
    });
});

describe("build hooks", () => {
  it("get the site when Astro prerenders in the build process", async () => {
    globalThis.FUMAPRESS_BUILD = { links: [] };
    const { getPressContext } = await load({ plugins: [build] }, { prerender: true });
    expect(globalThis.FUMAPRESS_BUILD?.ctx).toBe(getPressContext());
  });

  it("get the site with some pages prerendered", async () => {
    globalThis.FUMAPRESS_BUILD = { links: [] };
    const content = { docs: { files: [home] }, live: { files: () => [] } };
    const { getPressContext } = await load(
      { plugins: [build], content },
      { prerender: true, adapter: true },
    );
    expect(globalThis.FUMAPRESS_BUILD?.ctx).toBe(getPressContext());
  });

  it("fail when pages are prerendered elsewhere", async () => {
    await expect(load({ plugins: [build] }, { prerender: true })).rejects.toThrow(
      "remove `experimental.parallelPrerender` and prerender with Node",
    );
  });
});

it("needs an adapter for a dynamic source", async () => {
  await expect(load({ content: { docs: { files: () => [home] } } })).rejects.toThrow(
    "content renders on demand, add an adapter to Astro",
  );
});

it("has the path of pages in the provider data", async () => {
  const { getProviderData } = await load({});
  const astro = { url: new URL("http://localhost/docs/page/"), params: {} };
  expect(getProviderData(astro)).toEqual({ pathname: "/docs/page", params: {} });
});

it("makes your pages framework routes, before the views", async () => {
  const { getPressContext } = await load(
    {
      i18n: { languages: ["en", "cn"], defaultLanguage: "en" },
      plugins: [
        {
          routes({ createView }) {
            for (const lang of this.languages) createView(view("/blog", "blog", lang));
          },
        },
      ],
    },
    {
      routes: [
        { path: "/about", render: "static" },
        { path: "/cn/about", render: "static" },
        { path: "/users/[id]", render: "dynamic" },
      ],
    },
  );
  const routes = await getPressContext().getPageRoutes();
  expect(routes.map(({ path, lang, render }) => [path, lang, render])).toEqual([
    // outside the prefixes of the languages
    ["/about", undefined, "static"],
    ["/cn/about", "cn", "static"],
    ["/users/[id]", undefined, "dynamic"],
    ["/en/blog", "en", "static"],
    ["/cn/blog", "cn", "static"],
  ]);
  expect(routes[1]!.pages).toEqual([
    { path: "/cn/about", translations: [{ lang: "cn", path: "/cn/about" }], params: {} },
  ]);
});

it("keeps the URL segment of your pages in parenthesized folders, in the sitemap and in path conflicts", async () => {
  const { getPressContext } = await load(
    { plugins: [{ routes: ({ createView }) => createView(view("/y", "y")) }] },
    {
      routes: [
        { path: "/(x)/y", render: "static" },
        { path: "/(x)/[id]", render: "dynamic" },
      ],
    },
  );
  const routes = await getPressContext().getPageRoutes();
  expect(routes.map(({ path }) => path)).toEqual(["/%28x)/y", "/%28x)/[id]", "/y"]);
  expect(routes.map(({ pages }) => pages.map((page) => page.path))).toEqual([
    ["/%28x)/y"],
    [],
    ["/y"],
  ]);
});

it("takes the exports of `'use client'` modules in the registry as client references", async () => {
  const { getPressContext } = await load({});
  const { registerReference } = await import("@/island/references");
  const Client = () => null;
  registerReference("client", { Client });
  expect(getPressContext().isClientReference(Client)).toBe(true);
  expect(getPressContext().isClientReference(() => null)).toBe(false);
});

it("reports plugins of Waku in development", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  await load({ plugins: [{ name: "my-waku-plugin", waku: {} } as Plugin] });
  expect(warn).toHaveBeenCalledWith(expect.stringContaining("my-waku-plugin"));
  warn.mockRestore();
});
