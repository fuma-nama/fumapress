import { describe, expect, it } from "vitest";
import { withPageTrailingSlash, withTrailingSlash } from "@/lib/pathname";

describe("withTrailingSlash", () => {
  it("appends the slash before query and hash", () => {
    expect(withTrailingSlash("/post")).toBe("/post/");
    expect(withTrailingSlash("/post?a=1#h")).toBe("/post/?a=1#h");
    expect(withTrailingSlash("/post#h")).toBe("/post/#h");
  });

  it("keeps pathnames that already end with a slash", () => {
    expect(withTrailingSlash("/")).toBe("/");
    expect(withTrailingSlash("/post/")).toBe("/post/");
    expect(withTrailingSlash("/post/?a=1")).toBe("/post/?a=1");
  });

  it("keeps bare query and hash links", () => {
    expect(withTrailingSlash("#h")).toBe("#h");
    expect(withTrailingSlash("?a=1")).toBe("?a=1");
  });
});

describe("withPageTrailingSlash", () => {
  it("appends the slash to site-root page links", () => {
    expect(withPageTrailingSlash("/tags/guides")).toBe("/tags/guides/");
    expect(withPageTrailingSlash("/post?a=1#h")).toBe("/post/?a=1#h");
    expect(withPageTrailingSlash("/v1.2/docs")).toBe("/v1.2/docs/");
  });

  it("keeps files", () => {
    for (const href of ["/rss.xml", "/post.md", "/llms.txt", "/img/a.png", "/rss.xml?v=1"]) {
      expect(withPageTrailingSlash(href)).toBe(href);
    }
  });

  it("keeps non site-root links", () => {
    for (const href of [
      "/",
      "#h",
      "?a=1",
      "https://example.com/post",
      "//example.com/post",
      "mailto:a@example.com",
      "./post",
      "../post",
      "post",
    ]) {
      expect(withPageTrailingSlash(href)).toBe(href);
    }
  });
});
