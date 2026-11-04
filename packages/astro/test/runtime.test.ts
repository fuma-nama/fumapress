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

afterEach(() => {
  globalThis.FUMAPRESS_BUILD = undefined;
});

describe("mode", () => {
  it("is static without an adapter, default with one, dynamic with `output: 'server'`", async () => {
    expect((await load({})).getPressContext().mode).toBe("static");
    expect((await load({}, { adapter: true, defaultMode: "default" })).getPressContext().mode).toBe(
      "default",
    );
    expect((await load({}, { adapter: true, defaultMode: "dynamic" })).getPressContext().mode).toBe(
      "dynamic",
    );
    expect(
      (await load({ mode: "static" }, { adapter: true, defaultMode: "dynamic" })).getPressContext()
        .mode,
    ).toBe("static");
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

describe("provider data", () => {
  const astro = { url: new URL("http://localhost/docs/page/"), params: {} };

  it("has the path of pages", async () => {
    const { getProviderData } = await load({});
    expect(getProviderData(astro)).toEqual({ pathname: "/docs/page", params: {} });
  });
});

describe("framework routes", () => {
  it("are your pages, then the views", async () => {
    const { getPressContext } = await load(
      {
        i18n: { languages: ["en", "cn"], defaultLanguage: "en" },
        plugins: [
          {
            views: () => [{ path: "/blog", view: () => ({ type: "blog", props: {}, node: "" }) }],
          },
        ],
      },
      {
        routes: [
          { path: "/about", render: "static", pages: ["/about"] },
          { path: "/cn/about", render: "static", pages: ["/cn/about"] },
          { path: "/users/[id]", render: "dynamic", pages: [] },
        ],
      },
    );
    const routes = await getPressContext().getFrameworkRoutes();
    expect(routes.map(({ path, lang, render }) => [path, lang, render])).toEqual([
      ["/about", "en", "static"],
      ["/cn/about", "cn", "static"],
      ["/users/[id]", "en", "dynamic"],
      ["/en/blog", "en", "static"],
      ["/cn/blog", "cn", "static"],
    ]);
    expect(routes[0]!.pages).toEqual([{ path: "/about", translations: [], params: {} }]);
  });
});

describe("plugins of Waku", () => {
  it("are reported in development", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const waku = { name: "my-waku-plugin", waku: {} } as Plugin;
    await load({ plugins: [waku] });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("my-waku-plugin"));
    warn.mockRestore();
  });
});

describe("client references", () => {
  it("are the exports of `'use client'` modules in the registry", async () => {
    const { getPressContext } = await load({});
    const { registerReference } = await import("@/island/references");
    const Client = () => null;
    registerReference("client", { Client });
    expect(getPressContext().isClientReference(Client)).toBe(true);
    expect(getPressContext().isClientReference(() => null)).toBe(false);
  });
});
