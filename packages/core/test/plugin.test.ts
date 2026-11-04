import { describe, expect, it } from "vitest";
import type { ReactNode } from "react";
import type { MetaData, PageData, StaticSource } from "fumadocs-core/source";
import openapiPlugin from "fumadocs-openapi/press";
import { createOpenAPI } from "fumadocs-openapi/server";
import { recommendedPreset, wrapSlot } from "@/plugin";
import { pressContext } from "./harness";

describe("recommendedPreset", () => {
  it("loads its entries after your plugins, a listed provider taking an entry's place", async () => {
    const ctx = await pressContext({
      content: { files: [] },
      preset: recommendedPreset(),
      plugins: [{ name: "my-search", provides: ["search"] }, { name: "mine" }],
    });

    expect(ctx.plugins.map((plugin) => plugin.name)).toEqual([
      "mine",
      "core:sitemap",
      "core:robots",
      "core:llms.txt",
      "core:rss",
      "my-search",
      "core:takumi",
    ]);
    for (const plugin of ctx.plugins)
      if (plugin.name?.startsWith("core:")) expect(plugin.provides).toHaveLength(1);
  });

  it("drops an entry by its capability, others read the API of a capability", async () => {
    const ctx = await pressContext({
      content: { files: [] },
      preset: recommendedPreset().filter((entry) => entry.provides !== "rss"),
    });

    expect(ctx.plugins.map((plugin) => plugin.name)).not.toContain("core:rss");
    expect(ctx.getCapability("sitemap")?.path).toBe("/sitemap.xml");
  });
});

describe("slots", () => {
  it("wrap with the first item outermost", () => {
    const a = (props: { children?: ReactNode }) => props.children;
    expect(wrapSlot([{ slot: "layout.wrapper", component: a }], "page")).toMatchObject({
      props: { children: "page" },
    });
  });
});

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
