import { describe, expect, it, vi } from "vitest";
import type { AppContext } from "@/app/context";
import type { RouteFns } from "@/lib/types";
import { takumiPlugin, type TakumiOptions } from "@/plugins/takumi";
import { localizePath } from "@/lib/i18n";

vi.mock("waku/router/server", () => ({
  unstable_notFound() {
    throw new Error("not found");
  },
}));

type Api = Parameters<RouteFns["createApiIsomorphic"]>[0];

const pages = [
  { slugs: [], data: { title: "Home" } },
  { slugs: ["docs", "page"], data: { title: "Page", description: "Description" } },
];

async function init(options: TakumiOptions, overrides: Partial<AppContext> = {}) {
  const apis: Api[] = [];
  const ctx = {
    mode: "default",
    data: {},
    siteConfig: { name: "Site" },
    interceptPageMeta() {},
    localizePath: (lang: string | undefined, pathname: string) =>
      localizePath(overrides.i18nConfig, lang, pathname),
    isFallbackPage: () => false,
    absoluteUrl: (pathname: string) =>
      overrides.siteConfig?.baseUrl
        ? new URL(pathname, overrides.siteConfig.baseUrl).href
        : pathname,
    getLoader: () => ({
      getPages: () => pages,
      getPage: (slugs: string[]) => pages.find((page) => page.slugs.join("/") === slugs.join("/")),
    }),
    ...overrides,
  } as unknown as AppContext;
  const plugin = takumiPlugin(options);

  await plugin.init!.call(ctx);
  await plugin.createPages!.call(ctx, {
    createApiIsomorphic: (api: Api) => apis.push(api),
  } as unknown as RouteFns);

  return { apis, takumi: ctx.data["core:takumi"]! };
}

async function readImage(api: Api, slugs: string[] = []) {
  const res = await api.handler(new Request("http://localhost/"), { params: { slugs } });
  const bytes = new Uint8Array(await res.arrayBuffer());

  expect(res.headers.get("content-type")).toBe("image/webp");
  expect(String.fromCharCode(...bytes.subarray(0, 4))).toBe("RIFF");
  return res;
}

describe("getImageUrl", () => {
  it("resolves page and site images against the base URL", async () => {
    const { takumi } = await init(
      { site: { node: <div /> } },
      { siteConfig: { name: "Site", baseUrl: "https://example.com" } },
    );

    expect(takumi.getImageUrl(pages[0] as never)).toBe("https://example.com/index.webp");
    expect(takumi.getImageUrl(pages[1] as never)).toBe("https://example.com/docs/page.webp");
    expect(takumi.getImageUrl()).toBe("https://example.com/opengraph-image.webp");
  });

  it("follows locale, dynamic base path and custom site path", async () => {
    const { takumi } = await init(
      { site: { path: "/og.webp", node: <div /> } },
      { mode: "dynamic", i18nConfig: { languages: ["en", "cn"], defaultLanguage: "en" } as never },
    );

    expect(
      takumi.getImageUrl({ slugs: ["docs"], locale: "cn", path: "docs.cn.mdx" } as never),
    ).toBe("/cn/_takumi/docs.webp");
    expect(takumi.getImageUrl()).toBe("/og.webp");
  });

  it("throws without a site image", async () => {
    const { takumi } = await init({});

    expect(() => takumi.getImageUrl()).toThrow("site");
  });
});

describe("routes", () => {
  it("registers page images and the site image", async () => {
    const { apis } = await init({ site: { node: <div /> } });

    expect(apis.map((api) => [api.path, api.render])).toEqual([
      ["/[...slugs]", "static"],
      ["/opengraph-image.webp", "static"],
    ]);
    expect(apis[0]!.staticPaths).toEqual([["index.webp"], ["docs", "page.webp"]]);
  });

  it("applies shared options under the ones from generate()", async () => {
    const { apis } = await init({
      options: { headers: { "x-shared": "1" } },
      site: {
        node() {
          return <div>{this.siteConfig.name}</div>;
        },
      },
      generate: () => ({ node: <div>Page</div>, options: { status: 201 } }),
    });

    const page = await readImage(apis[0]!, ["docs", "page.webp"]);
    expect(page.status).toBe(201);
    expect(page.headers.get("x-shared")).toBe("1");

    const site = await readImage(apis[1]!);
    expect(site.status).toBe(200);
    expect(site.headers.get("x-shared")).toBe("1");
  });
});
