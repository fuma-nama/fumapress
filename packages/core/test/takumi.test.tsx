import { describe, expect, it, vi } from "vitest";
import type { ApiRoute } from "@/routes";
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
function createSite(options?: TakumiOptions, config: Partial<TestSite> = {}) {
  return pressContext(
    {
      content: {
        files: [
          page("index.mdx"),
          page("docs/basics.mdx"),
          page("docs/basics.cn.mdx"),
          page("docs/only-en.mdx"),
        ],
      },
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

    expect(ctx.getCapability("og-image")).toBeDefined();
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

  it("renders on request in dynamic mode, under `/_takumi` or `path`", async () => {
    const routes = async (options: TakumiOptions) =>
      (await createSite(options, { mode: "dynamic" })).getApiRoutes();

    expect((await routes({}))[0]).toMatchObject({ path: "/_takumi/[...slugs]", render: "dynamic" });
    const [route] = await routes({ path: "/images/" });
    expect(route).toMatchObject({ path: "/images/[...slugs]", render: "dynamic" });
    await readImage(route!, ["docs", "only-en.webp"]);
  });

  it("applies shared options under the ones from getImage()", async () => {
    const seen: string[] = [];
    const [route] = await (
      await createSite({
        width: 600,
        height: 315,
        options: { headers: { "x-shared": "1" }, status: 200, width: 300 },
        getImage(page) {
          seen.push(`${this.siteConfig.name} ${page.url}`);
          return { node: <div>Page</div>, options: { status: 201 } };
        },
      })
    ).getApiRoutes();

    const res = await readImage(route!, ["docs", "basics.webp"]);
    expect(res.status).toBe(201);
    expect(res.headers.get("x-shared")).toBe("1");
    expect(seen).toEqual(["Site /docs/basics"]);
  });
});

describe("page image", () => {
  async function headOf(slugs: string[], options?: TakumiOptions, config?: Partial<TestSite>) {
    const ctx = await createSite(options, config);
    const page = (await ctx.getLoader()).getPage(slugs, config?.i18n ? "cn" : undefined);
    return ctx.getHead({ page: page! });
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
    await expect((await createSite()).getHead({})).resolves.toEqual([]);
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
      "serves under `/_takumi` in dynamic mode",
      basics,
      { mode: "dynamic" },
      `${origin}/_takumi/docs/basics.webp`,
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
        routes: [{ path: "/about", render: "static", options: { ogImage: { title: "About" } } }],
      },
    );
    const [route] = await ctx.getPageRoutes();
    const image = (await ctx.getApiRoutes()).find((item) => item.path === "/about.webp");

    expect(image?.render).toBe("static");
    expect(await ctx.getHead({ route, path: "/about" })).toContainEqual({
      tag: "meta",
      attrs: { property: "og:image", content: "https://example.com/docs/about.webp" },
    });
  });
});
