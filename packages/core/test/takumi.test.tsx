import { describe, expect, it, vi } from "vitest";
import type { ApiRoute } from "fumadocs-core/framework/plugin";
import type { I18nConfig } from "fumadocs-core/i18n";
import type { VirtualFile } from "fumadocs-core/source";
import { createPress, type PressConfig } from "@/context";
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
function createSite(options?: TakumiOptions, config: Partial<PressConfig> = {}) {
  return createPress(
    {
      content: {
        files: [
          page("index.mdx"),
          page("docs/basics.mdx"),
          page("docs/basics.cn.mdx"),
          page("docs/only-en.mdx"),
        ],
      },
      preset: false,
      site: { name: "Site", baseUrl: "https://example.com/docs" },
      plugins: [takumiPlugin(options)],
      ...config,
    },
    { base: "/docs" },
  );
}

async function getPage(
  ctx: Awaited<ReturnType<typeof createSite>>,
  slugs: string[],
  lang?: string,
) {
  const page = (await ctx.getLoader()).getPage(slugs, lang);
  if (!page) throw new Error(`missing page ${slugs.join("/")} (${lang})`);
  return page;
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

    expect(ctx.getProvider("og-image")?.name).toBe("core:takumi");
    expect(routes.map(({ path, render, staticPaths }) => ({ path, render, staticPaths }))).toEqual([
      {
        path: "/[...slugs]",
        render: "static",
        staticPaths: [["index.webp"], ["docs", "basics.webp"], ["docs", "only-en.webp"]],
      },
      { path: "/cn/[...slugs]", render: "static", staticPaths: [["docs", "basics.webp"]] },
    ]);

    await readImage(routes[0]!, ["index.webp"]);
    await readImage(routes[1]!, ["docs", "basics.webp"]);
    expect((await request(routes[0]!, ["docs", "missing.webp"])).status).toBe(404);
  });

  it("renders on request in dynamic mode, under `/_takumi` or `basePath`", async () => {
    const routes = async (options: TakumiOptions) =>
      (await createSite(options, { mode: "dynamic" })).getApiRoutes();

    expect((await routes({}))[0]).toMatchObject({ path: "/_takumi/[...slugs]", render: "dynamic" });
    const [route] = await routes({ basePath: "/images/" });
    expect(route).toMatchObject({ path: "/images/[...slugs]", render: "dynamic" });
    await readImage(route!, ["docs", "only-en.webp"]);
  });

  it("applies shared options under the ones from generate()", async () => {
    const seen: string[] = [];
    const [route] = await (
      await createSite({
        width: 600,
        height: 315,
        options: { headers: { "x-shared": "1" }, status: 200, width: 300 },
        generate(page) {
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
  async function headOf(slugs: string[], options?: TakumiOptions, config?: Partial<PressConfig>) {
    const ctx = await createSite(options, config);
    return ctx.getHead({ page: await getPage(ctx, slugs, config?.i18n ? "cn" : undefined) });
  }

  it("adds the meta tags of content pages", async () => {
    const url = "https://example.com/docs/docs/basics.webp";

    expect((await headOf(["docs", "basics"], { width: 600, height: 315 })).slice(-4)).toEqual([
      { tag: "meta", attrs: { property: "og:image", content: url } },
      { tag: "meta", attrs: { property: "og:image:width", content: "600" } },
      { tag: "meta", attrs: { property: "og:image:height", content: "315" } },
      { tag: "meta", attrs: { property: "twitter:card", content: "summary_large_image" } },
    ]);
    await expect((await createSite()).getHead({})).resolves.toEqual([]);
  });

  it("localizes the image, fallback pages use the one of their origin", async () => {
    const image = async (slugs: string[], config?: Partial<PressConfig>) =>
      (await headOf(slugs, {}, config)).at(-4)?.attrs?.content;

    await expect(image(["docs", "basics"], { i18n })).resolves.toBe(
      "https://example.com/docs/cn/docs/basics.webp",
    );
    await expect(image(["docs", "only-en"], { i18n })).resolves.toBe(
      "https://example.com/docs/docs/only-en.webp",
    );
    await expect(image([])).resolves.toBe("https://example.com/docs/index.webp");
    await expect(image(["docs", "basics"], { mode: "dynamic" })).resolves.toBe(
      "https://example.com/docs/_takumi/docs/basics.webp",
    );
  });

  it("falls back to the base path without `site.baseUrl`", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const tags = await headOf(["docs", "basics"], {}, { site: { name: "Site" } });

    expect(tags.at(-4)?.attrs?.content).toBe("/docs/docs/basics.webp");
  });
});
