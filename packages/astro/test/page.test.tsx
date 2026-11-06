import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { parse } from "devalue";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { AppShape, Plugin } from "@fumapress/core";
import type { RuntimeContext } from "@fumapress/core/runtime";
import { registerReference } from "@/island/references";
import { AstroContent } from "@/island/serialize";
import * as client from "./fixtures/client";
import { pressContext, type TestSite } from "./harness";
import { contentSourcePlugin } from "@/content-source";
import { pageTreePlugin } from "@/island/page-tree";

const runtime = vi.hoisted(() => ({ ctx: undefined as RuntimeContext | undefined }));
vi.mock("@/routes/context", () => ({
  get ctx() {
    return runtime.ctx;
  },
}));
vi.mock("@/runtime", () => ({
  getProviderData: () => ({ pathname: "/cn/blog", params: {} }),
}));
vi.mock("@fumadocs/astro/source", () => ({ NoProcessedMarkdownError: class extends Error {} }));
vi.mock("astro:transitions/client", () => ({ navigate() {} }));
vi.mock("astro:config/client", () => ({ base: "/", trailingSlash: "ignore" }));

const { getHomeLayout, getPage } = await import("@/routes/render");
const { ContentProvider } = await import("@/ui/content");
const { Link } = await import("@/ui/link");
const { Provider } = await import("@/ui/provider");
const astro = {
  url: new URL("http://localhost/cn/blog"),
  params: {},
  request: new Request("http://localhost/cn/blog"),
};

/** a page rendered by `getPage()`, not a response */
async function renderedPage(props: Parameters<typeof getPage>[1]) {
  const page = await getPage(astro, props);
  if (page instanceof Response) throw new Error(`the response of a page: ${page.status}`);
  return page;
}
const docs = {
  files: [
    { type: "page" as const, path: "index.mdx", data: { title: "Home", load: async () => ({}) } },
  ],
};

async function site(plugin: Plugin<AppShape, any> = {}, config: Partial<TestSite> = {}) {
  const options: TestSite = {
    content: { docs },
    siteUrl: "https://example.com",
    plugins: [plugin],
    ...config,
  };
  runtime.ctx = await pressContext(options, {
    defaults: [contentSourcePlugin(), pageTreePlugin()],
  });
  // like the static paths or the routing of a request, before pages render
  await runtime.ctx.getPageRoutes();
  return runtime.ctx;
}

/** the island tree with its references by name */
function islandTree(tree: string): unknown {
  return parse(tree, {
    ref: ([, name]: [string, string]) => name,
    slot: String,
    tree: (nodes: unknown) => nodes,
  });
}

beforeAll(async () => {
  registerReference("provider", await import("@/ui/provider"));
  registerReference("home", await import("@/ui/home"));
  registerReference("docs", await import("@fumapress/core/ui/docs"));
  registerReference("shell", await import("@fumapress/core/ui/home"));
  registerReference("layout", await import("@/ui/layout-root"));
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

  it("keep `hideLocale` of the site with an `i18n` of `ui.providerProps`", async () => {
    await site(
      {},
      {
        i18n: { languages: ["en", "cn"], defaultLanguage: "en", hideLocale: "default-locale" },
        ui: { providerProps: { i18n: { translations: { Search: "搜尋" } } } },
      },
    );
    const { provider } = (await getHomeLayout(astro, { lang: "cn" })).island;

    expect(provider.i18n).toEqual({
      locale: "cn",
      defaultLanguage: "en",
      hideLocale: "default-locale",
      translations: { Search: "搜尋" },
    });
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
    const { island } = await renderedPage({ page: page! });

    expect(island.tree).toContain('"DefaultDocs"');
    expect(JSON.stringify(islandTree(island.tree))).toContain('"layout":"TestLayout"');
  });

  it("render the default UI with the page tree as a file, preloaded", async () => {
    const ctx = await site();
    const [page] = (await ctx.getLoader()).getPages();
    const { head, island } = await renderedPage({ page: page! });

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
    const { tree, pageTrees } = (await renderedPage({ page: page! })).island;

    expect(tree.indexOf('"Frame"')).toBeGreaterThan(-1);
    expect(tree.indexOf('"docs"')).toBeGreaterThan(tree.indexOf('"Frame"'));
    expect(tree.indexOf('"DefaultDocs"')).toBeGreaterThan(tree.indexOf('"Frame"'));
    expect(pageTrees).toHaveLength(1);
  });

  it("render views in the home layout, with their title", async () => {
    const view = { type: "test" as const, props: {}, node: "content", title: "Test" };
    const views: Plugin<AppShape, { views: { test: {} } }> = {
      routes: ({ createView }) => createView({ path: "/test", view: () => view }),
    };
    const ctx = await site(views);
    const [route] = await ctx.getPageRoutes();
    const { head, island } = await renderedPage({
      view: { route: route!, page: route!.pages[0]! },
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

describe("`.astro` layouts", () => {
  /** the default export of an `.astro` file */
  const AstroLayout = Object.assign(() => null, { isAstroComponentFactory: true });

  it("take the props of the page and the island of their React root", async () => {
    const ctx = await site(
      { slots: ({ page }) => (page ? [] : [{ slot: "layout.wrapper", component: client.Frame }]) },
      { ui: { renderPage: (props) => createElement(AstroLayout, props) } },
    );
    const [page] = (await ctx.getLoader()).getPages();
    const { island, layout } = await renderedPage({ page: page! });

    expect(layout?.component).toBe(AstroLayout);
    expect(layout?.props).toMatchObject({
      type: "docs",
      page,
      island: island.tree,
    });
    for (const name of ["body", "children", "renderDefault"])
      expect(layout?.props).not.toHaveProperty(name);

    expect(island.tree.indexOf('"Provider"')).toBeGreaterThan(-1);
    expect(island.tree.indexOf('"Frame"')).toBeGreaterThan(island.tree.indexOf('"Provider"'));
    expect(island.tree.indexOf('"LayoutRoot"')).toBeGreaterThan(island.tree.indexOf('"Frame"'));
  });

  it("keep the props of plugin views from their React root", async () => {
    const entries = [{ load() {} }];
    const ctx = await site(
      { getPageView: () => ({ props: { entries }, node: "view" }) },
      { ui: { renderPage: (props) => createElement(AstroLayout, props) } },
    );
    const [page] = (await ctx.getLoader()).getPages();
    const { island, layout } = await renderedPage({ page: page! });

    expect(layout?.props).toMatchObject({ entries });
    expect(island.tree).not.toContain("entries");
  });

  it("have the page content in their slot, `children` over the body", async () => {
    const pageContent = async (children?: string) => {
      const ctx = await site(
        { getPageBody: () => ({ node: "the body" }) },
        {
          ui: {
            renderPage: (props) =>
              createElement(AstroLayout, children ? { ...props, children } : props),
          },
        },
      );
      const [page] = (await ctx.getLoader()).getPages();
      const { layout } = await renderedPage({ page: page! });
      return JSON.stringify(layout?.content);
    };

    await expect(pageContent()).resolves.toContain("the body");
    const own = await pageContent("own content");
    expect(own).toContain("own content");
    expect(own).not.toContain("the body");
  });

  it("can't have Astro content in their options", async () => {
    const ctx = await site(
      {},
      {
        ui: {
          renderPage: (props) =>
            createElement(AstroLayout, {
              ...props,
              footer: { own: createElement(AstroContent, { component: AstroLayout as never }) },
            } as object),
        },
      },
    );
    const [page] = (await ctx.getLoader()).getPages();

    await expect(renderedPage({ page: page! })).rejects.toThrow(
      "the props of an `.astro` layout can't have Astro content",
    );
  });

  it("can't be nested in React content", async () => {
    const ctx = await site(
      {},
      { ui: { renderPage: () => createElement("div", null, createElement(AstroLayout)) } },
    );
    const [page] = (await ctx.getLoader()).getPages();

    await expect(renderedPage({ page: page! })).rejects.toThrow(
      "is in React content: `ui.renderPage` can return one as the layout of a page",
    );
  });
});

describe("links", () => {
  it("are recorded for the `build` of plugins, in the providers of pages and of content", () => {
    globalThis.FUMAPRESS_BUILD = { links: [] };
    const provider = { pathname: "/from", params: {} };
    const children = createElement(Link, { href: "/missing" });
    renderToString(createElement(Provider, { provider, props: {}, children }));
    renderToString(createElement(ContentProvider, { provider, children }));
    const { links } = globalThis.FUMAPRESS_BUILD;
    globalThis.FUMAPRESS_BUILD = undefined;

    const link = { href: "/missing", fromPathname: "/from" };
    expect(links).toEqual([link, link]);
  });
});

describe("responses", () => {
  it("redirect, and answer 404 for a view without content", async () => {
    const ctx = await site({
      routes: ({ createView }) => createView({ path: "/empty", view: () => undefined }),
    });
    const [route] = await ctx.getPageRoutes();
    const empty = await getPage(astro, { view: { route: route!, page: route!.pages[0]! } });
    const redirect = await getPage(astro, { redirect: "/sub/en" });

    expect((empty as Response).status).toBe(404);
    expect((redirect as Response).status).toBe(302);
    expect((redirect as Response).headers.get("Location")).toBe("/sub/en");
    expect(((await getPage(astro, {})) as Response).status).toBe(404);
  });

  it("render a dynamic view with the request", async () => {
    const view = vi.fn(() => ({ type: "test" as const, props: {}, node: "live" }));
    const ctx = await site({
      routes: ({ createView }) => createView({ path: "/live/[id]", render: "dynamic", view }),
    });
    const [route] = await ctx.getPageRoutes();
    const page = { path: "/live/42", params: { id: "42" }, translations: [] };
    const { island } = await renderedPage({ view: { route: route!, page } });

    expect(island.tree).toContain('"live"');
    expect(view).toHaveBeenCalledWith(page.params, { lang: undefined, request: astro.request });
  });
});

describe("head tags", () => {
  it("have no links on a not found page, with its title", async () => {
    await site();
    const { head: tags } = await getHomeLayout(astro, { title: "Gone", notFound: true });

    expect(tags).toContainEqual({ tag: "title", children: "Gone" });
    expect(tags.some((tag) => tag.tag === "link")).toBe(false);
  });

  it("link the translations of your page", async () => {
    await site();
    const { head } = await getHomeLayout(astro, {
      title: "Blog",
      alternates: [
        { lang: "en", hreflang: "en", href: "https://example.com/en/blog" },
        { lang: "cn", hreflang: "zh-Hant", href: "https://example.com/cn/blog" },
      ],
    });

    const link = (rel: string, href: string, hreflang?: string) => ({
      tag: "link",
      attrs: { rel, ...(hreflang && { hreflang }), href },
    });
    for (const tag of [
      { tag: "title", children: "Blog" },
      link("canonical", "https://example.com/cn/blog"),
      link("alternate", "https://example.com/en/blog", "en"),
      link("alternate", "https://example.com/cn/blog", "zh-Hant"),
      link("alternate", "https://example.com/en/blog", "x-default"),
    ])
      expect(head).toContainEqual(tag);
  });
});
