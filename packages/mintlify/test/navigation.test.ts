import { describe, expect, it } from "vitest";
import {
  buildPageTreeFromNavigation,
  createPageIndex,
  getMintlifyVersions,
  getNavigablePages,
  resolveNavigationContainer,
} from "@/navigation";
import { minimalDocs, multilingualDocs } from "./fixtures/docs";
import { page, sampleRoot } from "./fixtures/page-tree";

describe("createPageIndex", () => {
  it("indexes pages by normalized ref paths and basename", () => {
    const index = createPageIndex(sampleRoot);

    expect(index.get("getting-started")?.name).toBe("Getting Started");
    expect(index.get("guides/setup")?.name).toBe("Setup Guide");
    expect(index.get("overview")?.name).toBe("Overview v2");
  });
});

describe("resolveNavigationContainer", () => {
  it("selects the requested language navigation", () => {
    const container = resolveNavigationContainer(multilingualDocs.navigation, {
      language: "zh-Hans",
    });

    expect(container.pages).toEqual(["getting-started-cn"]);
  });

  it("falls back to the default language", () => {
    const container = resolveNavigationContainer(multilingualDocs.navigation, {
      language: "missing",
    });

    expect(container.pages).toEqual(["getting-started"]);
  });
});

describe("buildPageTreeFromNavigation", () => {
  it("builds a page tree from Mintlify navigation entries", async () => {
    const pageIndex = createPageIndex(sampleRoot);
    const tree = await buildPageTreeFromNavigation(minimalDocs.navigation, pageIndex);

    expect(tree).toHaveLength(2);
    expect(tree[0]).toMatchObject({ type: "page", name: "Getting Started" });
    expect(tree[1]).toMatchObject({ type: "page", name: "Setup Guide" });
  });

  it("creates external pages for http links", async () => {
    const pageIndex = createPageIndex(sampleRoot);
    const tree = await buildPageTreeFromNavigation(
      { pages: ["https://example.com/docs"] },
      pageIndex,
    );

    expect(tree).toEqual([
      expect.objectContaining({
        type: "page",
        url: "https://example.com/docs",
        external: true,
      }),
    ]);
  });

  it("builds nested groups and skips hidden entries", async () => {
    const pageIndex = createPageIndex(sampleRoot);
    const tree = await buildPageTreeFromNavigation(
      {
        groups: [
          {
            group: "Guides",
            expanded: true,
            icon: { name: "book" },
            pages: ["guides/setup"],
          },
          {
            group: "Hidden",
            hidden: true,
            pages: ["getting-started"],
          },
        ],
      },
      pageIndex,
    );

    expect(tree).toHaveLength(1);
    expect(tree[0]).toMatchObject({
      type: "folder",
      name: "Guides",
      defaultOpen: true,
    });
    // icons resolve to rendered Lucide components
    expect(tree[0]?.type === "folder" && tree[0].icon).toBeTruthy();
    expect(tree[0]?.type === "folder" && tree[0].children[0]).toMatchObject({
      type: "page",
      name: "Setup Guide",
    });
  });

  it("renders group tags as badges", async () => {
    const pageIndex = createPageIndex(sampleRoot);
    const tree = await buildPageTreeFromNavigation(
      {
        groups: [
          {
            group: "Guides",
            tag: "NEW",
            pages: ["guides/setup"],
          },
        ],
      },
      pageIndex,
    );

    // the name becomes a fragment with the group label + badge
    const name = tree[0]?.type === "folder" ? tree[0].name : undefined;
    expect(name).toBeTypeOf("object");
  });

  it("builds versioned navigation roots", async () => {
    const pageIndex = createPageIndex({
      ...sampleRoot,
      children: [page("v2/docs/overview", "Overview v2")],
    });

    const tree = await buildPageTreeFromNavigation(
      {
        versions: [
          {
            version: "v2",
            default: true,
            pages: ["overview"],
          },
        ],
      },
      pageIndex,
    );

    expect(tree).toHaveLength(1);
    expect(tree[0]).toMatchObject({
      type: "folder",
      name: "v2",
      root: true,
      defaultOpen: true,
    });
  });
});

describe("getMintlifyVersions", () => {
  it("returns versions from the resolved navigation container", () => {
    const versions = getMintlifyVersions({
      versions: [{ version: "v1", pages: ["getting-started"] }],
    });

    expect(versions).toEqual([{ version: "v1", pages: ["getting-started"] }]);
  });
});

describe("getNavigablePages", () => {
  it("collects page paths across languages, versions, tabs and groups", () => {
    const pages = getNavigablePages({
      pages: ["index"],
      tabs: [
        {
          tab: "Guides",
          groups: [{ group: "Setup", root: "setup/index", pages: ["setup/install"] }],
        },
      ],
      languages: [{ language: "en", pages: ["en/home"] }],
      versions: [{ version: "v2", pages: ["v2/changes"] }],
    });

    expect(pages).toEqual(
      new Set(["index", "setup/index", "setup/install", "en/home", "v2/changes"]),
    );
  });

  it("ignores external links", () => {
    const pages = getNavigablePages({ pages: ["https://example.com", "docs/page"] });

    expect(pages).toEqual(new Set(["page"]));
  });
});
