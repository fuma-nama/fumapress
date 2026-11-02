import { describe, expect, it } from "vitest";
import { expandRoute, matchRoute } from "@/routes";

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
