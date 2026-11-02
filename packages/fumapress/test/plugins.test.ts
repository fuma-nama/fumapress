import { afterEach, describe, expect, it, vi } from "vitest";
import { preinitPlugins, type PressPlugin } from "@/app/plugin";
import { sitemapPlugin } from "@/plugins/sitemap";
import { robotsPlugin } from "@/plugins/robots";
import { rssPlugin } from "@/plugins/rss";
import { oramaSearchPlugin } from "@/plugins/orama-search";

vi.mock("@/plugins/llms.txt", () => ({
  llmsPlugin: () => ({ name: "core:llms.txt" }),
}));

function names(plugins: PressPlugin[]): (string | undefined)[] {
  return plugins.map((plugin) => plugin.name);
}

describe("preinit", () => {
  it("removes plugins that return false", async () => {
    const plugins = await preinitPlugins(false, [
      { name: "a", preinit: () => false },
      { name: "b" },
    ]);

    expect(names(plugins)).toEqual(["b"]);
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
    expect(names(plugins)).toEqual(["b"]);
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
});

describe("recommended preset", () => {
  it("adds recommended plugins when enabled", async () => {
    const plugins = await preinitPlugins("recommended", [], { _debug_no_takumi: true });

    expect(names(plugins)).toEqual([
      "core:sitemap",
      "core:robots",
      "core:llms.txt",
      "core:rss",
      "core:flexsearch",
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
      { _debug_no_takumi: true },
    );

    expect(names(plugins)).toEqual([
      "core:orama-search",
      "core:sitemap",
      "core:robots",
      "core:llms.txt",
      "core:rss",
    ]);
  });

  it("does not add recommended plugins without the preset", async () => {
    const plugins = await preinitPlugins(false, [rssPlugin()]);

    expect(names(plugins)).toEqual(["core:rss"]);
  });
});

describe("image auto-configuration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("adds the image plugin of the detected platform", async () => {
    vi.stubEnv("FUMAPRESS_PLATFORM", "vercel");
    const plugins = await preinitPlugins("recommended", [], { _debug_no_takumi: true });

    expect(names(plugins)).toContain("image:vercel");
  });

  it("adds the self-hosted image plugin when sharp is installed", async () => {
    vi.stubEnv("FUMAPRESS_PLATFORM", "node");
    const plugins = await preinitPlugins("recommended", [], { _debug_no_takumi: true });

    expect(names(plugins)).toContain("image:self-hosted");
  });

  it("skips the self-hosted image plugin in static mode", async () => {
    vi.stubEnv("FUMAPRESS_PLATFORM", "node");
    const plugins = await preinitPlugins("recommended", [], {
      mode: "static",
      _debug_no_takumi: true,
    });

    expect(names(plugins)).not.toContain("image:self-hosted");
  });

  it("respects a user-configured image plugin", async () => {
    vi.stubEnv("FUMAPRESS_PLATFORM", "vercel");
    const plugins = await preinitPlugins("recommended", [{ name: "image:custom" }], {
      _debug_no_takumi: true,
    });

    expect(names(plugins)).toContain("image:custom");
    expect(names(plugins)).not.toContain("image:vercel");
  });

  it("skips unknown platforms", async () => {
    const plugins = await preinitPlugins("recommended", [], { _debug_no_takumi: true });

    expect(names(plugins).some((name) => name?.startsWith("image:"))).toBe(false);
  });
});
