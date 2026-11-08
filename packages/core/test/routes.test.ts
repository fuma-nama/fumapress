import { describe, expect, it } from "vitest";
import type { I18nConfig } from "fumadocs-core/i18n";
import type { VirtualFile } from "fumadocs-core/source";
import { i18n, page, pressContext } from "./harness";
import {
  expandRoute,
  getHomeUrl,
  matchPageRoute,
  matchRoute,
  rootRedirect,
  type PageRoute,
  type PageRouteInput,
} from "@/routes";

describe("matchPageRoute", () => {
  const route = (path: string): PageRoute => ({ path, render: "dynamic", pages: [], data: {} });
  const routes = [route("/a/[...rest]"), route("/a/[id]"), route("/a/b"), route("/other")];

  it("takes the most specific match, with its params", () => {
    expect(matchPageRoute(routes, "/a/b")?.route.path).toBe("/a/b");
    expect(matchPageRoute(routes, "/a/c")).toEqual({ route: routes[1], params: { id: "c" } });
    expect(matchPageRoute(routes, "/a/c/d")?.route.path).toBe("/a/[...rest]");
    expect(matchPageRoute(routes, "/none")).toBeUndefined();
  });
});

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
    expect(matchRoute("/[...lang]/about", "/zh/about")).toEqual({ lang: ["zh"] });
    expect(matchRoute("/llms.txt", "/llms.txt")).toEqual({});
    expect(matchRoute("/", "/")).toEqual({});
  });

  it("rejects other paths", () => {
    expect(matchRoute("/api/[id]", "/api")).toBeUndefined();
    expect(matchRoute("/api/[id]", "/api/a/b")).toBeUndefined();
    expect(matchRoute("/[...lang]/about", "/zh/pricing")).toBeUndefined();
    expect(matchRoute("/llms.txt", "/llms-full.txt")).toBeUndefined();
    expect(matchRoute("/api/[id]", "/api/%E0")).toBeUndefined();
  });
});

describe("getHomeUrl and rootRedirect", () => {
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
    const routes: PageRouteInput[] = [];
    for (const path of frameworkPages) routes.push({ path, render: "static" });
    return pressContext({ content: { files }, i18n: config ?? undefined }, { routes });
  }

  it("finds the home of a language, or its first page", async () => {
    const ctx = await create(docs);
    expect(await getHomeUrl(ctx, "cn")).toBe("/cn/docs/b");
    expect(await getHomeUrl(await create([page("index.cn.mdx"), ...docs]), "cn")).toBe("/cn");
    expect(await getHomeUrl(await create(docs, null), undefined)).toBe("/docs/b");
    expect(await getHomeUrl(await create([]), "en")).toBe("/en");
  });

  it("redirects to the home of the default language, or its first page", async () => {
    expect(await rootRedirect(await create([page("index.mdx"), ...docs]))).toBe("/en");
    expect(await rootRedirect(await create(docs, i18n, ["/en"]))).toBe("/en");
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
