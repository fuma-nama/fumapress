import { createElement } from "react";
import { parse } from "devalue";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { type AppShape, type Plugin, type Press } from "@fumapress/core";
import { pageAlternate, type RuntimeContext } from "@fumapress/core/runtime";
import { registerReference } from "@/island/references";
import * as client from "./fixtures/client";
import { pressContext, testPress, type TestSite } from "./harness";

const runtime = vi.hoisted(() => ({
  ctx: undefined as RuntimeContext | undefined,
  press: undefined as Press | undefined,
}));
vi.mock("@/runtime", () => ({
  getPressContext: () => runtime.ctx,
  getProviderData: () => ({ pathname: "/cn/blog", params: {} }),
}));
vi.mock("virtual:fumapress/config", () => ({
  get default() {
    return runtime.press;
  },
}));
vi.mock("@fumadocs/astro/source", () => ({ NoProcessedMarkdownError: class extends Error {} }));
vi.mock("astro:transitions/client", () => ({ navigate() {} }));
vi.mock("astro:config/client", () => ({ base: "/", trailingSlash: "ignore" }));

const { getHomeLayout, getPage } = await import("@/ui/page");
const astro = { url: new URL("http://localhost/cn/blog"), params: {} };
const docs = {
  files: [
    { type: "page" as const, path: "index.mdx", data: { title: "Home", load: async () => ({}) } },
  ],
};

async function site(plugin: Plugin<AppShape, any> = {}, config: Partial<TestSite> = {}) {
  const options: TestSite = {
    content: { docs },
    site: { baseUrl: "https://example.com" },
    plugins: [plugin],
    ...config,
  };
  runtime.press = testPress(options);
  runtime.ctx = await pressContext(options);
  return runtime.ctx;
}

/** the island tree with its references by name */
function islandTree(tree: string): unknown {
  return parse(tree, {
    ref: ([, name]: [string, string]) => name,
    slot: String,
    pageTree: String,
    tree: (nodes: unknown) => nodes,
  });
}

beforeAll(async () => {
  registerReference("provider", await import("@/ui/provider"));
  registerReference("home", await import("@/ui/home"));
  registerReference("default", await import("@/ui/default"));
  registerReference("client", client);
});

describe("layouts", () => {
  it("wrap the layout in `layout.wrapper`, inside the root provider", async () => {
    await site({
      slots: ({ page }) => (page ? [] : [{ slot: "layout.wrapper", component: client.Frame }]),
    });
    const { tree } = (await getHomeLayout(astro, {})).island;

    expect(tree.indexOf('"Provider"')).toBeGreaterThan(-1);
    expect(tree.indexOf('"Frame"')).toBeGreaterThan(tree.indexOf('"Provider"'));
    expect(tree.indexOf('"Home"')).toBeGreaterThan(tree.indexOf('"Frame"'));
  });

  it("pass `ui.providerProps` with the dialog of the search plugin to the root provider", async () => {
    const search: Plugin<AppShape, { provides: "search" }> = {
      provides: ["search"],
      providerProps: ({ lang }) => ({
        search: { SearchDialog: client.TestDialog, options: { api: "/api/search", locale: lang } },
      }),
    };
    await site(search, { ui: { providerProps: { theme: { defaultTheme: "dark" } } } });
    const { tree } = (await getHomeLayout(astro, {})).island;
    const [[, , props]] = islandTree(tree) as [[unknown, unknown, object]];

    expect(props).toMatchObject({
      props: {
        theme: { defaultTheme: "dark" },
        search: { SearchDialog: "TestDialog", options: { api: "/api/search" } },
      },
    });
  });
});

describe("pages", () => {
  it("render the Docs Layout of the `ai-chat` capability in the default UI", async () => {
    const ctx = await site({
      provides: ["ai-chat"],
      api: { DocsLayout: client.TestLayout },
    } as Plugin<AppShape, { provides: "ai-chat" }>);
    const [page] = (await ctx.getLoader()).getPages();
    const { island } = await getPage(astro, { page: page! });

    expect(island.tree).toContain('"DefaultDocs"');
    expect(JSON.stringify(islandTree(island.tree))).toContain('"layout":"TestLayout"');
  });

  it("render the default UI with the page tree as a file, preloaded", async () => {
    const ctx = await site();
    const [page] = (await ctx.getLoader()).getPages();
    const { head, island } = await getPage(astro, { page: page! });

    expect(island.tree).toContain('"DefaultDocs"');
    expect(island.pageTrees).toHaveLength(1);
    expect(island.pageTrees[0]).toMatch(/^\/_fumapress\/page-tree\/default\.[0-9a-f]{16}\.json$/);
    expect(island.tree).toContain(island.pageTrees[0]);
    expect(head).toContainEqual({ tag: "title", children: "Home" });
  });

  it("render `ui.renderPage`, with `renderDefault()`", async () => {
    const ctx = await site(
      {},
      {
        ui: {
          renderPage: (props) =>
            createElement(client.Frame, null, props.type, props.renderDefault()),
        },
      },
    );
    const [page] = (await ctx.getLoader()).getPages();
    const { tree, pageTrees } = (await getPage(astro, { page: page! })).island;

    expect(tree.indexOf('"Frame"')).toBeGreaterThan(-1);
    expect(tree.indexOf('"default"')).toBeGreaterThan(tree.indexOf('"Frame"'));
    expect(tree.indexOf('"DefaultDocs"')).toBeGreaterThan(tree.indexOf('"Frame"'));
    expect(pageTrees).toHaveLength(1);
  });

  it("render views in the home layout, with their title", async () => {
    const view = { type: "test" as const, props: {}, node: "content", title: "Test" };
    const views: Plugin<AppShape, { views: { test: {} } }> = {
      views: () => [{ path: "/test", view: () => view }],
    };
    const ctx = await site(views);
    const [routed] = await ctx.getViewRoutes();
    const { head, island } = await getPage(astro, {
      view: { ...routed!, page: routed!.route.pages[0]! },
      content: view,
    });

    expect(island.tree).toContain('"HomeShell"');
    expect(island.tree).toContain('"content"');
    expect(island.pageTrees).toEqual([]);
    expect(head).toContainEqual({ tag: "title", children: "Test" });
    expect(head).toContainEqual({
      tag: "link",
      attrs: { rel: "canonical", href: "https://example.com/test" },
    });
  });
});

describe("head tags", () => {
  it("link the translations of your page", async () => {
    const ctx = await site();
    const { head } = await getHomeLayout(astro, {
      title: "Blog",
      alternates: [pageAlternate(ctx, "en", "/en/blog"), pageAlternate(ctx, "cn", "/cn/blog")],
    });

    expect(head).toContainEqual({ tag: "title", children: "Blog" });
    expect(head).toContainEqual({
      tag: "link",
      attrs: { rel: "canonical", href: "https://example.com/cn/blog" },
    });
    expect(head).toContainEqual({
      tag: "link",
      attrs: { rel: "alternate", hreflang: "en", href: "https://example.com/en/blog" },
    });
  });
});
