import { describe, expect, it } from "vitest";
import type { SortedResult } from "fumadocs-core/search";
import { FetchSearchDialog } from "@/search.client";
import { FlexsearchDialog } from "@/plugins/flexsearch.client";
import { OramaSearchDialog } from "@/plugins/orama-search.client";
import { i18n, page, pressContext, type TestRuntime, type TestSite } from "./harness";
import type { Plugin } from "@/plugin";
import { flexsearchPlugin } from "@/plugins/flexsearch";
import { searchBreadcrumbs } from "@/search";
import { oramaSearchPlugin } from "@/plugins/orama-search";

const files = [
  page("docs/install.mdx", { title: "Install" }),
  page("docs/theme.mdx", { title: "Theme" }),
  page("docs/theme.cn.mdx", { title: "Theme (cn)" }),
];
const content: TestSite["content"] = { files };
const dynamic: TestSite["content"] = { files: () => files };

/** a content source with the text of each page for search */
const source: Plugin = {
  getPageStructuredData: (page) => ({
    headings: [],
    contents: [
      { heading: undefined, content: `${page.locale ?? ""} guide about ${page.slugs.at(-1)}` },
    ],
  }),
};

function createSite(config: Partial<TestSite> = {}, runtime: TestRuntime = {}) {
  return pressContext({ content, site: { baseUrl: "https://example.com" }, ...config }, runtime);
}

async function getSearchRoute(config: Partial<TestSite>) {
  const ctx = await createSite({ ...config, plugins: [source, config.plugins] });
  const route = (await ctx.getApiRoutes()).find((item) => item.path.startsWith("/api/search"));
  if (!route?.GET) throw new Error("missing the search route");
  const GET = route.GET;
  return {
    route,
    async search(query: string): Promise<SortedResult[]> {
      const res = await GET(new Request(`https://example.com/api/search?${query}`), { params: {} });
      return res.json();
    },
  };
}

describe.each([
  ["flexsearchPlugin", flexsearchPlugin, FlexsearchDialog],
  ["oramaSearchPlugin", oramaSearchPlugin, OramaSearchDialog],
] as const)("%s", (name, searchPlugin, StaticDialog) => {
  it("gives the root provider its dialog, of its index or of the server on each site, in each language", async () => {
    const plugin = searchPlugin();
    const ctx = await createSite({ content: dynamic, i18n, plugins: [plugin] }, { base: "/repo/" });
    const index = await createSite({ plugins: [plugin] });

    expect((await ctx.getProviderProps({ lang: "cn" })).search).toEqual({
      SearchDialog: FetchSearchDialog,
      options: { api: "/repo/api/search", locale: "cn" },
    });
    expect((await index.getProviderProps({ lang: undefined })).search).toEqual({
      SearchDialog: StaticDialog,
      options: { from: "/api/search.json" },
    });
  });

  it("keeps its options under the dialog of the site, `render` over the content source", async () => {
    function MyDialog() {
      return null;
    }
    const ctx = await createSite({
      plugins: [searchPlugin({ render: "dynamic" })],
      ui: { providerProps: { search: { SearchDialog: MyDialog } } },
    });

    expect((await ctx.getProviderProps({ lang: undefined })).search).toEqual({
      SearchDialog: MyDialog,
      options: { api: "/api/search" },
    });
  });

  it.each<[string, Partial<TestSite>["content"], "dynamic" | undefined]>([
    ["on a dynamic source", dynamic, undefined],
    ["with `render`", content, "dynamic"],
  ])("searches on the server %s", async (_, siteContent, render) => {
    const { route, search } = await getSearchRoute({
      content: siteContent,
      plugins: [searchPlugin({ render })],
    });

    expect(route.render).toBe("dynamic");
    expect(await search("query=install")).toContainEqual(
      expect.objectContaining({ type: "page", url: "/docs/install", content: "Install" }),
    );
  });

  it("searches the pages of a language", async () => {
    const { search } = await getSearchRoute({
      content: dynamic,
      i18n,
      plugins: [searchPlugin()],
    });
    const hit = (url: string) => expect.objectContaining({ url });

    const cn = await search("query=theme&locale=cn");
    expect(cn).toContainEqual(hit("/cn/docs/theme"));
    expect(cn).not.toContainEqual(hit("/en/docs/theme"));
    expect(await search("query=theme&locale=en")).toContainEqual(hit("/en/docs/theme"));
  });

  it.each<[string, Partial<TestSite>["content"], "static" | undefined]>([
    ["on static content", content, undefined],
    ["with `render`", dynamic, "static"],
  ])("exports the index of every language %s", async (_, siteContent, render) => {
    const { route, search } = await getSearchRoute({
      content: siteContent,
      i18n,
      plugins: [searchPlugin({ render })],
    });

    expect(route.render).toBe("static");
    const index = JSON.stringify(await search(""));
    expect(index).toContain("/cn/docs/theme");
    expect(index).toContain("/en/docs/install");
  });

  it("indexes pages without structured data by their title", async () => {
    const ctx = await createSite({ plugins: [searchPlugin()] });
    const [route] = await ctx.getApiRoutes();

    const response = await route!.GET!(new Request("https://example.com/api/search.json"), {
      params: {},
    });
    expect(response.status).toBe(200);
  });
});

it("disables the search of the root provider without a dialog", async () => {
  const ctx = await createSite();
  expect((await ctx.getProviderProps({ lang: undefined })).search).toEqual({ enabled: false });
});

it("breadcrumbs stay inside the root folder of a page, like the one of its layout", async () => {
  const page = { type: "page" as const, name: "Islands", url: "/docs/astro/layouts/islands" };
  const tree = {
    name: "Docs",
    children: [
      {
        type: "folder" as const,
        name: "Documentation",
        children: [
          {
            type: "folder" as const,
            name: "Astro",
            root: true,
            children: [
              { type: "separator" as const, name: "Customize" },
              { type: "folder" as const, name: "Layouts", children: [page] },
            ],
          },
        ],
      },
    ],
  };
  const ctx = { getLoader: async () => ({ getPageTree: () => tree }) };

  expect(await searchBreadcrumbs(ctx as never, { url: page.url } as never)).toEqual([
    "Customize",
    "Layouts",
  ]);
});
