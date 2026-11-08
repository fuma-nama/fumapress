import { describe, expect, it, vi } from "vitest";
import type { ApiRoute, RouteParams } from "@/routes";
import type { I18nConfig } from "fumadocs-core/i18n";
import type { VirtualFile } from "fumadocs-core/source";
import { pressContext, type TestSite } from "./harness";
import { takumiPlugin, type TakumiOptions } from "@/plugins/takumi";

function page(file: string): VirtualFile {
  return { type: "page", path: file, data: { title: file, description: `About ${file}` } };
}

const i18n: I18nConfig = {
  languages: ["en", "cn"],
  defaultLanguage: "en",
  hideLocale: "default-locale",
};

/** `docs/basics` is translated, `docs/only-en` falls back to English in `cn` */
const files = [
  page("index.mdx"),
  page("docs/basics.mdx"),
  page("docs/basics.cn.mdx"),
  page("docs/only-en.mdx"),
];
const dynamic: Partial<TestSite> = { content: { files: () => files } };
/** `docs/a` is prerendered, `live/b` renders on demand */
const mixed: Partial<TestSite> = {
  content: {
    docs: { files: [page("docs/a.mdx")] },
    live: { files: () => [page("live/b.mdx")] },
  },
};

function createSite(options?: TakumiOptions, config: Partial<TestSite> = {}) {
  return pressContext(
    {
      content: { files },
      site: { name: "Site", baseUrl: "https://example.com/docs" },
      plugins: [takumiPlugin(options)],
      ...config,
    },
    { base: "/docs" },
  );
}

function request(route: ApiRoute, slugs: string[]) {
  return route.GET!(new Request("https://example.com/"), { params: { slugs } });
}

async function readImage(route: ApiRoute, slugs: string[]) {
  const res = await request(route, slugs);
  const bytes = new Uint8Array(await res.arrayBuffer());

  expect(res.headers.get("content-type")).toBe("image/webp");
  expect(String.fromCharCode(...bytes.subarray(0, 4))).toBe("RIFF");
  return res;
}

describe("routes", () => {
  it("serves the images of every language without fallback pages", async () => {
    const ctx = await createSite({}, { i18n });
    const routes = await ctx.getApiRoutes();

    // the most specific first
    expect(routes.map(({ path, render, staticPaths }) => ({ path, render, staticPaths }))).toEqual([
      { path: "/cn/[...slugs]", render: "static", staticPaths: [["docs", "basics.webp"]] },
      {
        path: "/[...slugs]",
        render: "static",
        staticPaths: [["index.webp"], ["docs", "basics.webp"], ["docs", "only-en.webp"]],
      },
    ]);

    await readImage(routes[1]!, ["index.webp"]);
    await readImage(routes[0]!, ["docs", "basics.webp"]);
    expect((await request(routes[1]!, ["docs", "missing.webp"])).status).toBe(404);
  });

  it("renders on demand on a dynamic source, under `/_takumi` or `path`", async () => {
    const routes = async (options: TakumiOptions) =>
      (await createSite(options, dynamic)).getApiRoutes();

    expect(await routes({})).toMatchObject([{ path: "/_takumi/[...slugs]", render: "dynamic" }]);
    const [route] = await routes({ path: "/images/" });
    expect(route).toMatchObject({ path: "/images/[...slugs]", render: "dynamic" });
    await readImage(route!, ["docs", "only-en.webp"]);
    expect((await request(route!, ["index.webp"])).headers.get("Cache-Control")).toBeNull();
  });

  it("gives the images rendered on demand the `staleTime` of their source", async () => {
    const [route] = await (
      await createSite({}, { content: { files: () => files, staleTime: 5000 } })
    ).getApiRoutes();
    const res = await readImage(route!, ["docs", "only-en.webp"]);
    expect(res.headers.get("Cache-Control")).toBe("public, s-maxage=5");
  });

  it("prerenders the images of static sources next to the on-request route of dynamic ones", async () => {
    const routes = await (await createSite({}, mixed)).getApiRoutes();

    expect(routes.map(({ path, render, staticPaths }) => ({ path, render, staticPaths }))).toEqual([
      { path: "/_takumi/[...slugs]", render: "dynamic", staticPaths: undefined },
      { path: "/[...slugs]", render: "static", staticPaths: [["docs", "a.webp"]] },
    ]);
    await readImage(routes[0]!, ["live", "b.webp"]);
    await readImage(routes[1]!, ["docs", "a.webp"]);
  });

  it("takes both routes at `path`, the static one first for frameworks registering its pattern once", async () => {
    const routes = await (await createSite({ path: "/images" }, mixed)).getApiRoutes();

    expect(routes.map(({ path, render }) => [path, render])).toEqual([
      ["/images/[...slugs]", "static"],
      ["/images/[...slugs]", "dynamic"],
    ]);
  });
});

describe("page image", () => {
  async function headOf(slugs: string[], options?: TakumiOptions, config?: Partial<TestSite>) {
    const ctx = await createSite(options, config);
    const page = (await ctx.getLoader()).getPage(slugs, config?.i18n ? "cn" : undefined);
    return ctx.getHead({ lang: page!.locale, page: page! });
  }

  const imageOf = async (slugs: string[], options?: TakumiOptions, config?: Partial<TestSite>) =>
    (await headOf(slugs, options, config)).find((tag) => tag.attrs?.property === "og:image")?.attrs
      ?.content;

  it("adds the meta tags of content pages", async () => {
    const url = "https://example.com/docs/docs/basics.webp";

    const tags = await headOf(["docs", "basics"], { width: 600, height: 315 });
    expect(
      tags.filter((tag) => /^(og:image|twitter:card)/.test(tag.attrs?.property ?? "")),
    ).toEqual([
      { tag: "meta", attrs: { property: "og:image", content: url } },
      { tag: "meta", attrs: { property: "og:image:width", content: "600" } },
      { tag: "meta", attrs: { property: "og:image:height", content: "315" } },
      { tag: "meta", attrs: { property: "twitter:card", content: "summary_large_image" } },
    ]);
    await expect((await createSite()).getHead({ lang: undefined })).resolves.toEqual([]);
  });

  const origin = "https://example.com/docs";
  const basics = ["docs", "basics"];

  it.each<[string, string[], Partial<TestSite> | undefined, string]>([
    ["localizes the image", basics, { i18n }, `${origin}/cn/docs/basics.webp`],
    [
      "uses the origin's on fallback pages",
      ["docs", "only-en"],
      { i18n },
      `${origin}/docs/only-en.webp`,
    ],
    ["names the root image `index`", [], undefined, `${origin}/index.webp`],
    [
      "serves under `/_takumi` on a dynamic source",
      basics,
      dynamic,
      `${origin}/_takumi/docs/basics.webp`,
    ],
    ["follows a static source of a mixed site", ["docs", "a"], mixed, `${origin}/docs/a.webp`],
    [
      "follows a dynamic source of a mixed site",
      ["live", "b"],
      mixed,
      `${origin}/_takumi/live/b.webp`,
    ],
    [
      "falls back to the base path without `site.baseUrl`",
      basics,
      { site: { name: "Site" } },
      "/docs/docs/basics.webp",
    ],
  ])("%s", async (_, slugs, config, expected) => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(imageOf(slugs, {}, config)).resolves.toBe(expected);
  });

  it("is under `path` for every source", async () => {
    const options = { path: "/images" };

    await expect(imageOf(["docs", "a"], options, mixed)).resolves.toBe(
      `${origin}/images/docs/a.webp`,
    );
    await expect(imageOf(["live", "b"], options, mixed)).resolves.toBe(
      `${origin}/images/live/b.webp`,
    );
  });
});

describe("route images", () => {
  it("draws the `ogImage` of page routes, with their head tags", async () => {
    const ctx = await pressContext(
      {
        content: { files: [] },
        site: { baseUrl: "https://example.com/docs" },
        plugins: [takumiPlugin()],
      },
      {
        base: "/docs/",
        routes: [{ path: "/about", render: "static", data: { ogImage: { title: "About" } } }],
      },
    );
    const [route] = await ctx.getPageRoutes();
    const image = (await ctx.getApiRoutes()).find((item) => item.path === "/about.webp");

    expect(image?.render).toBe("static");
    expect(await ctx.getHead({ lang: undefined, route, path: "/about" })).toContainEqual({
      tag: "meta",
      attrs: { property: "og:image", content: "https://example.com/docs/about.webp" },
    });
  });

  it("follows a page route rendered on demand under `/_takumi`", async () => {
    const ctx = await pressContext(
      {
        content: { files: [] },
        site: { baseUrl: "https://example.com" },
        plugins: [takumiPlugin()],
      },
      {
        routes: [{ path: "/live/[id]", render: "dynamic", data: { ogImage: { title: "Live" } } }],
      },
    );
    const [route] = await ctx.getPageRoutes();
    const image = (await ctx.getApiRoutes()).find((item) => item.path === "/_takumi/live/[id]");

    expect(image?.render).toBe("dynamic");
    expect(await ctx.getHead({ lang: undefined, route, path: "/live/42" })).toContainEqual({
      tag: "meta",
      attrs: { property: "og:image", content: "https://example.com/_takumi/live/42" },
    });
  });

  it("follows the page data: an `ogImage` of `transformPage`, a function called with the params", async () => {
    const image = vi.fn((params: RouteParams) => ({ title: `Live ${String(params.id)}` }));
    const ctx = await pressContext(
      {
        content: { files: [] },
        site: { baseUrl: "https://example.com" },
        plugins: [
          takumiPlugin(),
          { transformPage: (_, { path }) => (path === "/about" ? { ogImage: {} } : undefined) },
        ],
      },
      {
        routes: [
          { path: "/about", render: "static" },
          { path: "/plain", render: "static" },
          { path: "/live/[id]", render: "dynamic", data: { ogImage: image } },
        ],
      },
    );
    const [about, plain, live] = await ctx.getPageRoutes();
    const paths = (await ctx.getApiRoutes()).map((route) => route.path);

    expect(paths).toContain("/about.webp");
    expect(paths).not.toContain("/plain.webp");
    expect(await ctx.getHead({ lang: undefined, route: about!, path: "/about" })).toContainEqual(
      expect.objectContaining({
        attrs: { property: "og:image", content: "https://example.com/about.webp" },
      }),
    );
    expect(
      (await ctx.getHead({ lang: undefined, route: plain!, path: "/plain" })).some(
        (tag) => tag.attrs?.property === "og:image",
      ),
    ).toBe(false);
    // `ui.renderPage` gets data, not functions: Astro serializes it into the island
    await expect(ctx.getPageData(live!, "/live/42")).resolves.toMatchObject({
      ogImage: { title: "Live 42" },
    });
    expect(image).toHaveBeenCalledWith({ id: "42" });
  });
});
