import { afterEach, describe, expect, it, vi } from "vitest";
import { resolvePlugins } from "@fumapress/core";
import { preinitPlugins, recommendedPlugins, type PressPlugin } from "@/app/plugin";
import { sitemapPlugin } from "@/plugins/sitemap";
import { robotsPlugin } from "@/plugins/robots";
import { buildRSS, rssPlugin } from "@/plugins/rss";
import { flexsearchPlugin } from "@/plugins/flexsearch";
import { oramaSearchPlugin } from "@/plugins/orama-search";

vi.mock("@/plugins/llms.txt", () => ({
  llmsPlugin: () => ({ name: "llms.txt" }),
}));

function names(plugins: readonly PressPlugin[]): (string | undefined)[] {
  return plugins.map((plugin) => plugin.name);
}

/** `plugins` with the preset, as the app resolves them */
async function preset(plugins: PressPlugin[], mode: "default" | "static" = "default") {
  return resolvePlugins<PressPlugin>(plugins, await recommendedPlugins(mode, plugins));
}

describe("preinit", () => {
  it("removes plugins that return false", async () => {
    const plugins = await preinitPlugins([{ name: "a", preinit: () => false }, { name: "b" }]);

    expect(names(plugins)).toEqual(["b"]);
  });

  it("later plugins receive finalized plugins prior to themselves", async () => {
    let received: (string | undefined)[] | undefined;
    const plugins = await preinitPlugins([
      { name: "a", preinit: () => false },
      {
        name: "b",
        preinit({ finalized }) {
          received = names(finalized);
        },
      },
    ]);

    expect(received).toEqual([]);
    expect(names(plugins)).toEqual(["b"]);
  });

  it("propagates thrown errors", async () => {
    await expect(
      preinitPlugins([
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
    const plugins = await preinitPlugins([{ name: "a" }, false, [{ name: "b" }, null, undefined]]);

    expect(names(plugins)).toEqual(["a", "b"]);
  });

  it("respects enforce order", async () => {
    const plugins = await preinitPlugins([
      { name: "normal" },
      { name: "post", enforce: "post" },
      { name: "pre", enforce: "pre" },
    ]);

    expect(names(plugins)).toEqual(["pre", "normal", "post"]);
  });
});

describe("conflict checks", () => {
  it("throws on two search plugins", async () => {
    await expect(preinitPlugins([flexsearchPlugin(), oramaSearchPlugin()])).rejects.toThrow(
      'both provide "search"',
    );
  });

  it("throws on duplicated search plugins of the same type", async () => {
    await expect(preinitPlugins([flexsearchPlugin(), flexsearchPlugin()])).rejects.toThrow(
      'both provide "search"',
    );
  });
});

describe("recommended preset", () => {
  it("adds recommended plugins when enabled", async () => {
    expect(names(await preset([]))).toEqual([
      "sitemap",
      "robots",
      "llms.txt",
      "rss",
      "flexsearch",
      "takumi",
    ]);
  });

  it("skips recommended defaults already provided by the user", async () => {
    const plugins = await preset([
      oramaSearchPlugin(),
      sitemapPlugin({ path: "/custom-sitemap.xml" }),
      robotsPlugin(),
      { name: "llms.txt" },
      rssPlugin(),
    ]);

    expect(names(plugins)).toEqual([
      "orama-search",
      "sitemap",
      "robots",
      "llms.txt",
      "rss",
      "takumi",
    ]);
    expect(plugins.filter((plugin) => plugin.name === "sitemap")).toHaveLength(1);
    expect(plugins.filter((plugin) => plugin.name === "flexsearch")).toHaveLength(0);
  });
});

describe("image auto-configuration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("adds the image plugin of the detected platform", async () => {
    vi.stubEnv("FUMAPRESS_PLATFORM", "vercel");

    expect(names(await preset([]))).toContain("image:vercel");
  });

  it("adds the self-hosted image plugin when sharp is installed", async () => {
    vi.stubEnv("FUMAPRESS_PLATFORM", "node");

    expect(names(await preset([]))).toContain("image:self-hosted");
  });

  it("skips the self-hosted image plugin in static mode", async () => {
    vi.stubEnv("FUMAPRESS_PLATFORM", "node");

    expect(names(await preset([], "static"))).not.toContain("image:self-hosted");
  });

  it("respects a user-configured image plugin", async () => {
    vi.stubEnv("FUMAPRESS_PLATFORM", "vercel");
    const plugins = await preset([{ name: "image:custom" }]);

    expect(names(plugins)).toContain("image:custom");
    expect(names(plugins)).not.toContain("image:vercel");
  });

  it("skips unknown platforms", async () => {
    expect(names(await preset([])).some((name) => name?.startsWith("image:"))).toBe(false);
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
