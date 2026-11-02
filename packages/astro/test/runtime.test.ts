import { afterEach, describe, expect, it, vi } from "vitest";
import type { Plugin, PressConfig } from "@fumapress/core";

type AstroValues = typeof import("virtual:fumapress/astro");

/** the runtime with the config of the site, and the values of the integration */
async function load(config: Partial<PressConfig>, astro: Partial<AstroValues> = {}) {
  vi.resetModules();
  vi.doMock("virtual:fumapress/config", () => ({
    default: { content: {}, preset: false, ...config },
  }));
  vi.doMock("virtual:fumapress/astro", () => ({
    adapter: false,
    mode: "static",
    pages: [],
    prerender: false,
    siteUrl: undefined,
    ...astro,
  }));
  vi.doMock("astro:config/client", () => ({ trailingSlash: "ignore" }));
  vi.doMock("@/content-source", () => ({ contentSourcePlugin: () => ({ name: "fumapress" }) }));
  return import("@/runtime");
}

const search: Plugin = { name: "core:flexsearch", provides: ["search"] };
const build: Plugin = { build() {} };

afterEach(() => {
  globalThis.FUMAPRESS_BUILD = undefined;
});

describe("mode", () => {
  it("is static without an adapter, default with one, dynamic with `output: 'server'`", async () => {
    expect((await load({})).getPressContext().mode).toBe("static");
    expect((await load({}, { adapter: true, mode: "default" })).getPressContext().mode).toBe(
      "default",
    );
    expect((await load({}, { adapter: true, mode: "dynamic" })).getPressContext().mode).toBe(
      "dynamic",
    );
    expect(
      (await load({ mode: "static" }, { adapter: true, mode: "dynamic" })).getPressContext().mode,
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

  it("has the path of pages, and the engine of search plugins", async () => {
    const { getProviderData } = await load({ plugins: [search] });
    expect(getProviderData(astro)).toEqual({
      pathname: "/docs/page",
      params: {},
      search: "flexsearch",
    });

    const server = await load({ plugins: [search] }, { adapter: true, mode: "default" });
    expect(server.getProviderData(astro).search).toBe("fetch");
    expect((await load({})).getProviderData(astro).search).toBeUndefined();
  });
});
