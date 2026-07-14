import { describe, expect, it, vi } from "vitest";
import { preinitPlugins, type PressPlugin } from "@/app/plugin";
import { sitemapPlugin } from "@/plugins/sitemap";
import { robotsPlugin } from "@/plugins/robots";
import { buildRSS, rssPlugin } from "@/plugins/rss";
import { flexsearchPlugin } from "@/plugins/flexsearch";
import { oramaSearchPlugin } from "@/plugins/orama-search";

vi.mock("@/plugins/llms.txt", () => ({
  llmsPlugin: () => ({ name: "core:llms.txt" }),
}));

const ALWAYS = ["core:i18n", "core:disable-search-if-needed"];

function names(plugins: PressPlugin[]): (string | undefined)[] {
  return plugins.map((plugin) => plugin.name);
}

describe("preinit", () => {
  it("removes plugins that return false", async () => {
    const plugins = await preinitPlugins(false, [
      { name: "a", preinit: () => false },
      { name: "b" },
    ]);

    expect(names(plugins)).toEqual(["b", ...ALWAYS]);
  });

  it("later plugins receive finalized plugins prior to themselves", async () => {
    let received: (string | undefined)[] | undefined;
    const plugins = await preinitPlugins(false, [
      { name: "a", preinit: () => false },
      {
        name: "b",
        preinit({ finalized }) {
          received = finalized.map((plugin) => plugin.name);
        },
      },
    ]);

    expect(received).toEqual([]);
    expect(names(plugins)).toEqual(["b", ...ALWAYS]);
  });

  it("propagates thrown errors", async () => {
    await expect(
      preinitPlugins(false, [
        {
          name: "a",
          preinit() {
            throw new Error("conflict!");
          },
        },
      ]),
    ).rejects.toThrow("conflict!");
  });

  it("flattens nested plugin options and skips falsy entries", async () => {
    const plugins = await preinitPlugins(false, [
      { name: "a" },
      false,
      [{ name: "b" }, null, undefined],
    ]);

    expect(names(plugins)).toEqual(["a", "b", ...ALWAYS]);
  });

  it("respects enforce order", async () => {
    const plugins = await preinitPlugins(false, [
      { name: "normal" },
      { name: "post", enforce: "post" },
      { name: "pre", enforce: "pre" },
    ]);

    expect(names(plugins)).toEqual([
      "pre",
      "normal",
      "core:i18n",
      "post",
      "core:disable-search-if-needed",
    ]);
  });
});

describe("conflict checks", () => {
  it("throws on two search plugins", async () => {
    await expect(preinitPlugins(false, [flexsearchPlugin(), oramaSearchPlugin()])).rejects.toThrow(
      "only one search plugin",
    );
  });

  it("throws on duplicated search plugins of the same type", async () => {
    await expect(preinitPlugins(false, [flexsearchPlugin(), flexsearchPlugin()])).rejects.toThrow(
      "only one search plugin",
    );
  });
});

describe("recommended preset", () => {
  it("adds recommended plugins when enabled", async () => {
    const plugins = await preinitPlugins("recommended", [], true);

    expect(names(plugins)).toEqual([
      "core:i18n",
      "core:sitemap",
      "core:robots",
      "core:llms.txt",
      "core:rss",
      "core:flexsearch",
      "core:disable-search-if-needed",
    ]);
  });

  it("skips recommended defaults already provided by the user", async () => {
    const plugins = await preinitPlugins(
      "recommended",
      [
        oramaSearchPlugin(),
        sitemapPlugin({ path: "/custom-sitemap.xml" }),
        robotsPlugin(),
        { name: "core:llms.txt" },
        rssPlugin(),
      ],
      true,
    );

    expect(names(plugins)).toEqual([
      "core:orama-search",
      "core:sitemap",
      "core:robots",
      "core:llms.txt",
      "core:rss",
      ...ALWAYS,
    ]);
    expect(plugins.filter((plugin) => plugin.name === "core:sitemap")).toHaveLength(1);
    expect(plugins.filter((plugin) => plugin.name === "core:flexsearch")).toHaveLength(0);
  });

  it("does not add recommended plugins without the preset", async () => {
    const plugins = await preinitPlugins(false, [rssPlugin()]);

    expect(names(plugins)).toEqual(["core:rss", ...ALWAYS]);
  });
});

describe("rss", () => {
  it("builds a valid feed", () => {
    const xml = buildRSS({
      title: "My Site",
      link: "https://example.com",
      description: "My Site",
      selfUrl: "https://example.com/rss.xml",
      items: [
        {
          title: "Hello World",
          link: "https://example.com/blog/hello",
          description: "First post",
          pubDate: new Date("2026-01-01T00:00:00Z"),
        },
        {
          title: "No Date",
          link: "https://example.com/blog/no-date",
        },
      ],
    });

    expect(xml).toContain(`<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">`);
    expect(xml).toContain("<title>My Site</title>");
    expect(xml).toContain(
      `<atom:link href="https://example.com/rss.xml" rel="self" type="application/rss+xml"/>`,
    );
    expect(xml).toContain("<lastBuildDate>Thu, 01 Jan 2026 00:00:00 GMT</lastBuildDate>");
    expect(xml).toContain("<pubDate>Thu, 01 Jan 2026 00:00:00 GMT</pubDate>");
    expect(xml).toContain("<guid>https://example.com/blog/hello</guid>");
    expect(xml).toContain("<title>No Date</title>");
  });
});
