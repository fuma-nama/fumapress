import { describe, expect, expectTypeOf, it } from "vitest";
import type * as Framework from "fumadocs-core/framework/plugin";
import type { LoaderConfig, MetaData, PageData, StaticSource } from "fumadocs-core/source";
import openapiPlugin from "fumadocs-openapi/press";
import { createOpenAPI } from "fumadocs-openapi/server";
import { pressContext } from "./harness";
import {
  recommendedPreset,
  type AppShape,
  type Plugin,
  type RecommendedPresetOptions,
} from "@/plugin";
import { createPress, type InferAppShape, type RenderPageProps } from "@/press";

describe("plugins of the framework API", () => {
  it("fit typed sites, like the plugins of integrations", async () => {
    const server = createOpenAPI({
      input: {
        shop: {
          openapi: "3.2.0",
          info: { title: "Shop", version: "1.0.0" },
          paths: {
            "/items": { get: { summary: "List items", responses: { 200: { description: "OK" } } } },
          },
        },
      },
    });
    const docs: StaticSource<{ pageData: PageData & { tags: string[] }; metaData: MetaData }> = {
      files: [{ type: "page", path: "index.mdx", data: { title: "Home", tags: ["a", "b"] } }],
    };
    const ctx = await pressContext({
      content: { docs, openapi: await server.staticSource() },
      site: { baseUrl: "https://example.com" },
      plugins: [
        openapiPlugin({ server }),
        {
          getPageText: (page) =>
            "tags" in page.data && Array.isArray(page.data.tags)
              ? page.data.tags.join(", ")
              : undefined,
        },
      ],
    });
    const pages = (await ctx.getLoader()).getPages();
    const home = pages.find((page) => page.type === "docs");
    const operation = pages.find((page) => page.type === "openapi");
    if (!home || !operation) throw new Error("missing pages");

    await expect(ctx.getPageText(home)).resolves.toBe("a, b");
    await expect(ctx.getPageBody(operation)).resolves.toHaveProperty("node");
    await expect(ctx.getPageData(operation)).resolves.toMatchObject({ full: true });
  });
});

describe("plugin types of a site", () => {
  const content = { files: [] };

  it("collect the slot names", () => {
    const share: Plugin<AppShape, { slots: "acme:share" }> = {
      slots: () => [{ name: "acme:share", region: "actions", component: () => null }],
    };
    const app = createPress<typeof content, undefined, AppShape, {}>(content).plugins(
      share,
      {} as Plugin,
    );
    expectTypeOf<keyof RenderPageProps<typeof app, undefined>["slots"]>().toEqualTypeOf<
      "core:markdown" | "core:view-options" | "acme:share"
    >();
  });

  it("type the pages of the site in options of framework plugins", () => {
    type Docs = StaticSource<{ pageData: PageData & { tags: string[] }; metaData: MetaData }>;
    type Site = InferAppShape<{ docs: Docs }, undefined, "test">;
    // like `mdxPlugin()` of Fumadocs MDX
    const renderer = <Config extends LoaderConfig>(_options: {
      components: (page: Config["page"]) => object;
    }): Framework.Plugin<Config> => ({});
    createPress<{ docs: Docs }, undefined, Site, {}>({ docs: { files: [] } }).plugins(
      renderer({
        components: (page) => {
          expectTypeOf(page.data.tags).toEqualTypeOf<string[]>();
          return {};
        },
      }),
    );
  });

  it("refuse slot items a plugin doesn't name", () => {
    const plugin: Plugin<AppShape, { slots: "acme:share" }> = {
      // @ts-expect-error not a name of the plugin
      slots: () => [{ name: "acme:other", region: "actions", component: () => null }],
    };
    expect(plugin).toBeDefined();
  });

  it("link the sitemap of the preset in robots.txt, unless robots.txt says otherwise", async () => {
    const robots = async (options: RecommendedPresetOptions) => {
      const ctx = await pressContext({
        content: { files: [] },
        site: { baseUrl: "https://example.com" },
        preset: recommendedPreset({
          llms: false,
          rss: false,
          search: false,
          ogImage: false,
          ...options,
        }),
      });
      const route = (await ctx.getApiRoutes()).find((item) => item.path === "/robots.txt");
      return (
        await route!.GET!(new Request("https://example.com/robots.txt"), { params: {} })
      ).text();
    };

    await expect(robots({ sitemap: { path: "/map.xml" } })).resolves.toContain(
      "Sitemap: https://example.com/map.xml",
    );
    await expect(robots({})).resolves.toContain("Sitemap: https://example.com/sitemap.xml");
    await expect(
      robots({ sitemap: { path: "/map.xml" }, robots: { sitemap: "/own.xml" } }),
    ).resolves.toContain("Sitemap: https://example.com/own.xml");
    await expect(robots({ robots: { sitemap: false } })).resolves.not.toContain("Sitemap");
    await expect(robots({ sitemap: false })).resolves.not.toContain("Sitemap");
  });

  it("type the preset options by the default plugins", () => {
    recommendedPreset({ sitemap: { path: "/map.xml" }, rss: false, search: false });
    // @ts-expect-error robots takes a path or `false`
    recommendedPreset({ robots: { sitemap: true } });
  });
});
