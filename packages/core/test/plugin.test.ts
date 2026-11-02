import { describe, expect, it, vi } from "vitest";
import type { MetaData, PageData, StaticSource } from "fumadocs-core/source";
import { openapiPlugin } from "fumadocs-openapi/plugin";
import { createOpenAPI } from "fumadocs-openapi/server";
import { createPress } from "@/context";
import { recommendedPreset, resolvePlugins, type Plugin, type PresetEntry } from "@/plugin";

function names(plugins: Plugin[]) {
  return plugins.map((plugin) => plugin.name);
}

/** a preset entry loading `plugin` */
function entry(plugin: Plugin & { name: string }): PresetEntry {
  return { name: plugin.name, provides: plugin.provides, load: () => plugin };
}

describe("resolvePlugins", () => {
  it("flattens nested options and skips falsy ones", async () => {
    const plugins = await resolvePlugins(
      [{ name: "a" }, false, [{ name: "b" }, null, [undefined, { name: "c" }]]],
      [],
    );

    expect(names(plugins)).toEqual(["a", "b", "c"]);
  });

  it("sorts by enforce and keeps the order otherwise", async () => {
    const plugins = await resolvePlugins(
      [
        { name: "a" },
        { name: "post", enforce: "post" },
        { name: "b" },
        { name: "pre", enforce: "pre" },
      ],
      [entry({ name: "preset" }), entry({ name: "preset-pre", enforce: "pre" })],
    );

    expect(names(plugins)).toEqual(["pre", "preset-pre", "a", "b", "preset", "post"]);
  });

  it("loads only the preset plugins that no plugin replaces", async () => {
    const orama = vi.fn(() => ({ name: "orama-search" }));
    const plugins = await resolvePlugins(
      [{ name: "sitemap" }, { name: "my-search", provides: ["search"] }],
      [
        entry({ name: "sitemap", enforce: "pre" }),
        { name: "orama-search", provides: ["search"], load: orama },
        entry({ name: "takumi", provides: ["og-image"] }),
      ],
    );

    expect(names(plugins)).toEqual(["sitemap", "my-search", "takumi"]);
    expect(plugins[0]!.enforce).toBeUndefined();
    expect(orama).not.toHaveBeenCalled();
  });

  it("loads the recommended preset under the names of its plugins", async () => {
    const plugins = await resolvePlugins(
      [{ name: "my-search", provides: ["search"] }],
      recommendedPreset(),
    );

    expect(names(plugins)).toEqual([
      "my-search",
      "core:sitemap",
      "core:robots",
      "core:rss",
      "core:takumi",
      "core:llms.txt",
    ]);
  });

  it("throws when two plugins provide a capability", async () => {
    await expect(
      resolvePlugins(
        [
          { name: "core:flexsearch", provides: ["search"] },
          { name: "core:orama-search", provides: ["search"] },
        ],
        [],
      ),
    ).rejects.toThrow(
      '[Fumapress] "core:orama-search" conflicts with "core:flexsearch": only one search plugin can be added.',
    );
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
    const ctx = await createPress(
      {
        content: { docs, openapi: await server.staticSource() },
        preset: false,
        site: { baseUrl: "https://example.com" },
        plugins: [
          openapiPlugin({ server }),
          { getPageText: (page) => (page.type === "docs" ? page.data.tags.join(", ") : undefined) },
        ],
      },
      { base: "/" },
    );
    const pages = (await ctx.getLoader()).getPages();
    const home = pages.find((page) => page.type === "docs");
    const operation = pages.find((page) => page.type === "openapi");
    if (!home || !operation) throw new Error("missing pages");

    await expect(ctx.getPageText(home)).resolves.toBe("a, b");
    await expect(ctx.getPageBody(operation)).resolves.toHaveProperty("node");
    await expect(ctx.getPageData(operation)).resolves.toMatchObject({ full: true });
  });
});
