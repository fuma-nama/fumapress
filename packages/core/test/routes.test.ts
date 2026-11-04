import { describe, expect, it } from "vitest";
import type { I18nConfig } from "fumadocs-core/i18n";
import type { VirtualFile } from "fumadocs-core/source";
import { pressContext } from "./harness";
import type { RuntimeRoute } from "@/context";
import { compareRoutes, expandRoute, getHomeUrl, matchRoute, rootRedirect } from "@/routes";

describe("expandRoute", () => {
  it("lists a page per entry of `staticPaths`, without route groups", () => {
    expect(expandRoute("/(docs)/docs/[lang]/[...slugs]", [["en", "a", "b"], ["cn"]])).toEqual({
      pattern: "/docs/[lang]/[...slugs]",
      pages: [
        { pathname: "/docs/en/a/b", params: { lang: "en", slugs: ["a", "b"] } },
        { pathname: "/docs/cn", params: { lang: "cn", slugs: [] } },
      ],
    });
    expect(expandRoute("/[...slugs]", [[]]).pages).toEqual([
      { pathname: "/", params: { slugs: [] } },
    ]);
    expect(expandRoute("/blog/[slug]", ["a"]).pages).toEqual([
      { pathname: "/blog/a", params: { slug: "a" } },
    ]);
  });

  it("is one page at the path without params, or with `exactPath`", () => {
    expect(expandRoute("/llms.txt", undefined).pages).toEqual([
      { pathname: "/llms.txt", params: {} },
    ]);
    expect(expandRoute("/[id]", ["a"], true).pages).toEqual([{ pathname: "/[id]", params: {} }]);
  });
});

describe("matchRoute", () => {
  it("returns the params of matching paths", () => {
    expect(matchRoute("/api/[id]", "/api/a%20b")).toEqual({ id: "a b" });
    expect(matchRoute("/api/[...slugs]", "/api/a/b/")).toEqual({ slugs: ["a", "b"] });
    expect(matchRoute("/api/[...slugs]", "/api")).toEqual({ slugs: [] });
    expect(matchRoute("/llms.txt", "/llms.txt")).toEqual({});
    expect(matchRoute("/", "/")).toEqual({});
  });

  it("rejects other paths", () => {
    expect(matchRoute("/api/[id]", "/api")).toBeUndefined();
    expect(matchRoute("/api/[id]", "/api/a/b")).toBeUndefined();
    expect(matchRoute("/llms.txt", "/llms-full.txt")).toBeUndefined();
    expect(matchRoute("/api/[id]", "/api/%E0")).toBeUndefined();
  });

  it("matches the pages of `expandRoute`", () => {
    const { pattern, pages } = expandRoute("/docs/[...slugs]", [["a", "b"], []]);
    for (const { pathname, params } of pages) expect(matchRoute(pattern, pathname)).toEqual(params);
  });
});

describe("getHomeUrl and rootRedirect", () => {
  const i18n: I18nConfig = { languages: ["en", "cn"], defaultLanguage: "en" };
  const page = (path: string): VirtualFile => ({ type: "page", path, data: { title: path } });
  const docs: VirtualFile[] = [
    {
      type: "meta",
      path: "docs/meta.json",
      data: { pages: ["[Site](https://example.com)", "b", "a"] },
    },
    page("docs/a.mdx"),
    page("docs/b.mdx"),
    page("docs/b.cn.mdx"),
  ];

  async function create(
    files: VirtualFile[],
    config: I18nConfig | null = i18n,
    frameworkPages: string[] = [],
  ) {
    const routes: RuntimeRoute[] = [];
    for (const path of frameworkPages)
      routes.push({
        route: {
          path,
          render: "static",
          pages: [{ path, translations: [], params: {} }],
          options: {},
        },
      });
    return pressContext({ content: { files }, preset: [], i18n: config ?? undefined }, { routes });
  }

  it("finds the home of a language, or its first page", async () => {
    const ctx = await create(docs);
    expect(await getHomeUrl(ctx, "cn")).toBe("/cn/docs/b");
    expect(await getHomeUrl(await create([page("index.cn.mdx"), ...docs]), "cn")).toBe("/cn");
    expect(await getHomeUrl(await create(docs, null), undefined)).toBe("/docs/b");
    expect(await getHomeUrl(await create([]), "en")).toBe("/en");
  });

  it("redirects to the home of the default language", async () => {
    expect(await rootRedirect(await create([page("index.mdx"), ...docs]))).toBe("/en");
    expect(await rootRedirect(await create(docs, i18n, ["/en"]))).toBe("/en");
  });

  it("redirects to the first page of the default language without its home", async () => {
    expect(await rootRedirect(await create(docs))).toBe("/en/docs/b");
  });

  it("leaves `/` alone with a page there, or without a language prefix", async () => {
    expect(await rootRedirect(await create(docs, i18n, ["/"]))).toBeUndefined();
    expect(
      await rootRedirect(await create(docs, { ...i18n, hideLocale: "default-locale" })),
    ).toBeUndefined();
    expect(await rootRedirect(await create(docs, null))).toBeUndefined();
  });
});

describe("compareRoutes", () => {
  it("sorts static segments, then params, then rest params", () => {
    const paths = [
      "/[...slugs]",
      "/blog/[slug]",
      "/blog/tags",
      "/blog/[...rest]",
      "/blog",
      "/[lang]/x",
    ];
    expect(paths.sort(compareRoutes)).toEqual([
      "/blog/tags",
      "/blog",
      "/blog/[slug]",
      "/blog/[...rest]",
      "/[lang]/x",
      "/[...slugs]",
    ]);
  });
});
