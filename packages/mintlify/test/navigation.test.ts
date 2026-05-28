import { describe, expect, it } from "vitest";
import {
  buildPageTreeFromNavigation,
  createPageIndex,
  getMintlifyVersions,
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
  it("builds a page tree from Mintlify navigation entries", () => {
    const pageIndex = createPageIndex(sampleRoot);
    const tree = buildPageTreeFromNavigation(minimalDocs.navigation, pageIndex);

    expect(tree).toHaveLength(2);
    expect(tree[0]).toMatchObject({ type: "page", name: "Getting Started" });
    expect(tree[1]).toMatchObject({ type: "page", name: "Setup Guide" });
  });

  it("creates external pages for http links", () => {
    const pageIndex = createPageIndex(sampleRoot);
    const tree = buildPageTreeFromNavigation({ pages: ["https://example.com/docs"] }, pageIndex);

    expect(tree).toEqual([
      expect.objectContaining({
        type: "page",
        url: "https://example.com/docs",
        external: true,
      }),
    ]);
  });

  it("builds nested groups and skips hidden entries", () => {
    const pageIndex = createPageIndex(sampleRoot);
    const tree = buildPageTreeFromNavigation(
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
      icon: "book",
    });
    expect(tree[0]?.type === "folder" && tree[0].children[0]).toMatchObject({
      type: "page",
      name: "Setup Guide",
    });
  });

  it("builds versioned navigation roots", () => {
    const pageIndex = createPageIndex({
      ...sampleRoot,
      children: [page("v2/docs/overview", "Overview v2")],
    });

    const tree = buildPageTreeFromNavigation(
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
