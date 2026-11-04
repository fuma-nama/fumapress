import { describe, expect, it, vi } from "vitest";
import type { I18nConfig } from "fumadocs-core/i18n";
import type { SortedResult } from "fumadocs-core/search";
import type { UseSearchReturn } from "fumadocs-core/search/client";
import { usePressSearch, useServerSearch, type PressSearch } from "@/search.client";
import { useFlexsearchIndex } from "@/plugins/flexsearch.client";
import { useOramaIndex } from "@/plugins/orama-search.client";
import { pressContext, type TestRuntime, type TestSite } from "./harness";
import type { Plugin } from "@/plugin";
import { flexsearchPlugin } from "@/plugins/flexsearch";
import { oramaSearchPlugin } from "@/plugins/orama-search";

const i18n: I18nConfig = { languages: ["en", "cn"], defaultLanguage: "en" };

/** the value of `PressSearchContext`, outside of rendering */
const provided = vi.hoisted(() => ({ search: undefined as PressSearch | undefined }));
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  use: () => provided.search,
}));

describe("usePressSearch", () => {
  it("calls the hook of the search plugin in the language of the page from the server", () => {
    const result: UseSearchReturn = { search: "", onSearchChange() {}, isLoading: false };
    const hook = vi.fn((_props: object): UseSearchReturn => result);
    provided.search = { client: { hook, props: { from: "/api/search" } }, lang: "cn" };

    expect(usePressSearch()).toBe(result);
    expect(hook).toHaveBeenCalledWith({ from: "/api/search", lang: "cn" });
  });

  it("throws without a search plugin", () => {
    provided.search = undefined;
    expect(() => usePressSearch()).toThrow("the site has none");
  });
});

const content: TestSite["content"] = {
  files: [
    { type: "page", path: "docs/install.mdx", data: { title: "Install" } },
    { type: "page", path: "docs/theme.mdx", data: { title: "Theme" } },
    { type: "page", path: "docs/theme.cn.mdx", data: { title: "Theme (cn)" } },
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
  return pressContext(
    { content, preset: [], site: { baseUrl: "https://example.com" }, ...config },
    runtime,
  );
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
  ["flexsearchPlugin", flexsearchPlugin, useFlexsearchIndex],
  ["oramaSearchPlugin", oramaSearchPlugin, useOramaIndex],
] as const)("%s", (name, searchPlugin, useIndex) => {
  it("provides search, with the client hook of its index or of the server on each site", async () => {
    // one plugin value on two sites: its API is complete at creation, nothing writes it
    const plugin = searchPlugin();
    const ctx = await createSite({ plugins: [plugin] }, { base: "/repo/" });
    const index = await createSite({ mode: "static", plugins: [plugin] });
    const api = ctx.getCapability("search");

    expect(api).toBe(plugin.api);
    expect(api?.client(ctx)).toEqual({ hook: useServerSearch, props: { api: "/repo/api/search" } });
    expect(api?.client(index)).toEqual({ hook: useIndex, props: { from: "/api/search" } });
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

    const cn = await search("query=theme&locale=cn");
    expect(cn).toContainEqual(expect.objectContaining({ url: "/cn/docs/theme" }));
    expect(cn).not.toContainEqual(expect.objectContaining({ url: "/en/docs/theme" }));
    expect(await search("query=theme&locale=en")).toContainEqual(
      expect.objectContaining({ url: "/en/docs/theme" }),
    );
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

describe("search plugins", () => {
  it("only one provides search", async () => {
    await expect(
      createSite({ plugins: [flexsearchPlugin(), oramaSearchPlugin()] }),
    ).rejects.toThrow('"core:flexsearch" and "core:orama-search" both provide "search"');
  });

  it("replace the search of the preset", async () => {
    const ctx = await createSite(
      { preset: undefined, plugins: [flexsearchPlugin()] },
      {
        preset: () => [{ name: "core:orama-search", provides: "search", load: oramaSearchPlugin }],
      },
    );

    expect(ctx.plugins.map((plugin) => plugin.name)).toEqual(["core:flexsearch"]);
  });
});
