import { afterEach, describe, expect, it, vi } from "vitest";
import type { Plugin } from "@fumapress/core";
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
    defaultMode: "static",
    routes: [],
    prerender: false,
    siteUrl: undefined,
    ...astro,
  }));
  vi.doMock("astro:config/client", () => ({ trailingSlash: "ignore" }));
  vi.doMock("@/content-source", () => ({ contentSourcePlugin: () => ({ name: "fumapress" }) }));
  return import("@/runtime");
}

const build: Plugin = { build() {} };
const view = (path: string, type: string, lang?: string) => ({
  lang,
  path,
  view: () => ({ type, props: {}, node: "" }),
});

afterEach(() => {
  globalThis.FUMAPRESS_BUILD = undefined;
});

describe("mode", () => {
  it.each<[string, Partial<TestSite>, Partial<AstroValues>, string]>([
    ["static without an adapter", {}, {}, "static"],
    ["default with an adapter", {}, { adapter: true, defaultMode: "default" }, "default"],
    ["dynamic with `output: 'server'`", {}, { adapter: true, defaultMode: "dynamic" }, "dynamic"],
    ["yours over Astro's", { mode: "static" }, { adapter: true, defaultMode: "dynamic" }, "static"],
  ])("is %s", async (_, config, astro, expected) => {
    expect((await load(config, astro)).getPressContext().mode).toBe(expected);
  });

  it("needs an adapter to render on request", async () => {
    await expect(load({ mode: "default" })).rejects.toThrow("add an adapter to Astro");
  });
});

describe("build hooks", () => {
  it("get the site when Astro prerenders in the build process", async () => {
    globalThis.FUMAPRESS_BUILD = { links: [] };
    const { getPressContext } = await load({ plugins: [build] }, { prerender: true });
    expect(globalThis.FUMAPRESS_BUILD?.ctx).toBe(getPressContext());
  });

  it("are skipped without plugins of them", async () => {
    globalThis.FUMAPRESS_BUILD = { links: [] };
    await load({}, { prerender: true });
    expect(globalThis.FUMAPRESS_BUILD).toBeUndefined();
  });

  it("fail when pages are prerendered elsewhere, or render on request", async () => {
    await expect(load({ plugins: [build] }, { prerender: true })).rejects.toThrow(
      "remove `experimental.parallelPrerender` and prerender with Node",
    );
    globalThis.FUMAPRESS_BUILD = { links: [] };
    await expect(
      load({ plugins: [build], mode: "dynamic" }, { prerender: true, adapter: true }),
    ).rejects.toThrow('pages render on request in `mode: "dynamic"`');
  });
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
