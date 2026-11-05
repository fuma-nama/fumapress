import { describe, expect, it } from "vitest";
import type { SortedResult } from "fumadocs-core/search";
import { FetchSearchDialog } from "@/search.client";
import { FlexsearchDialog } from "@/plugins/flexsearch.client";
import { OramaSearchDialog } from "@/plugins/orama-search.client";
import { i18n, page, pressContext, type TestRuntime, type TestSite } from "./harness";
import type { Plugin } from "@/plugin";
import { flexsearchPlugin } from "@/plugins/flexsearch";
import { oramaSearchPlugin } from "@/plugins/orama-search";

const content: TestSite["content"] = {
  files: [
    page("docs/install.mdx", { title: "Install" }),
    page("docs/theme.mdx", { title: "Theme" }),
    page("docs/theme.cn.mdx", { title: "Theme (cn)" }),
  ],
};

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
  const route = (await ctx.getApiRoutes()).find((item) => item.path === "/api/search");
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
    const ctx = await createSite({ i18n, plugins: [plugin] }, { base: "/repo/" });
    const index = await createSite({ mode: "static", plugins: [plugin] });

    expect((await ctx.getProviderProps({ lang: "cn" })).search).toEqual({
      SearchDialog: FetchSearchDialog,
      options: { api: "/repo/api/search", locale: "cn" },
    });
    expect((await index.getProviderProps({ lang: undefined })).search).toEqual({
      SearchDialog: StaticDialog,
      options: { from: "/api/search" },
    });
  });

  it("keeps its options under the dialog of the site", async () => {
    function MyDialog() {
      return null;
    }
    const ctx = await createSite({
      plugins: [searchPlugin()],
      ui: { providerProps: { search: { SearchDialog: MyDialog } } },
    });

    expect((await ctx.getProviderProps({ lang: undefined })).search).toEqual({
      SearchDialog: MyDialog,
      options: { api: "/api/search" },
    });
  });

  it("searches on the server outside static mode", async () => {
    for (const mode of ["default", "dynamic"] as const) {
      const { route, search } = await getSearchRoute({ mode, plugins: [searchPlugin()] });

      expect(route.render).toBe("dynamic");
      expect(await search("query=install")).toContainEqual(
        expect.objectContaining({ type: "page", url: "/docs/install", content: "Install" }),
      );
    }
  });

  it("searches the pages of a language", async () => {
    const { search } = await getSearchRoute({ i18n, plugins: [searchPlugin()] });
    const hit = (url: string) => expect.objectContaining({ url });

    const cn = await search("query=theme&locale=cn");
    expect(cn).toContainEqual(hit("/cn/docs/theme"));
    expect(cn).not.toContainEqual(hit("/en/docs/theme"));
    expect(await search("query=theme&locale=en")).toContainEqual(hit("/en/docs/theme"));
  });

  it("exports the index of every language in static mode", async () => {
    const { route, search } = await getSearchRoute({
      mode: "static",
      i18n,
      plugins: [searchPlugin()],
    });

    expect(route.render).toBe("static");
    const index = JSON.stringify(await search(""));
    expect(index).toContain("/cn/docs/theme");
    expect(index).toContain("/en/docs/install");
  });

  it("builds the index with `buildIndex`", async () => {
    const { search } = await getSearchRoute({
      plugins: [
        searchPlugin({
          buildIndex(page) {
            return {
              id: page.url,
              url: page.url,
              title: `${page.data.title} of ${this.siteConfig.name}`,
              structuredData: { headings: [], contents: [] },
            };
          },
        }),
      ],
    });

    expect(await search("query=install")).toContainEqual(
      expect.objectContaining({ url: "/docs/install", content: "Install of Fumapress" }),
    );
  });

  it("requires structured data from content sources", async () => {
    const ctx = await createSite({ plugins: [searchPlugin()] });
    const [route] = await ctx.getApiRoutes();

    await expect(
      route!.GET!(new Request("https://example.com/api/search?query=install"), { params: {} }),
    ).rejects.toThrow(`Please specify the \`buildIndex\` option to ${name}()`);
  });
});

it("disables the search of the root provider without a dialog", async () => {
  const ctx = await createSite();
  expect((await ctx.getProviderProps({ lang: undefined })).search).toEqual({ enabled: false });
});
