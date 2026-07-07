import { describe, expect, it } from "vitest";
import { createRedirectMatcher } from "@/features/redirects";

describe("createRedirectMatcher", () => {
  it("matches exact paths", () => {
    const match = createRedirectMatcher([{ source: "/old", destination: "/new" }]);

    expect(match("/old")).toEqual({ destination: "/new", permanent: true });
    expect(match("/old/")).toEqual({ destination: "/new", permanent: true });
    expect(match("/other")).toBeUndefined();
    expect(match("/old/nested")).toBeUndefined();
  });

  it("supports single-segment parameters", () => {
    const match = createRedirectMatcher([{ source: "/guides/:slug", destination: "/docs/:slug" }]);

    expect(match("/guides/setup")).toEqual({ destination: "/docs/setup", permanent: true });
    expect(match("/guides/setup/extra")).toBeUndefined();
    expect(match("/guides")).toBeUndefined();
  });

  it("supports catch-all parameters", () => {
    const match = createRedirectMatcher([{ source: "/beta/:slug*", destination: "/v2/:slug*" }]);

    expect(match("/beta/a/b/c")).toEqual({ destination: "/v2/a/b/c", permanent: true });
    expect(match("/beta")).toEqual({ destination: "/v2", permanent: true });
    expect(match("/stable/a")).toBeUndefined();
  });

  it("respects the permanent flag", () => {
    const match = createRedirectMatcher([{ source: "/a", destination: "/b", permanent: false }]);

    expect(match("/a")).toEqual({ destination: "/b", permanent: false });
  });

  it("preserves absolute destination URLs", () => {
    const match = createRedirectMatcher([
      { source: "/external/:slug*", destination: "https://example.com/:slug*" },
    ]);

    expect(match("/external/docs/page")).toEqual({
      destination: "https://example.com/docs/page",
      permanent: true,
    });
  });

  it("uses the first matching redirect", () => {
    const match = createRedirectMatcher([
      { source: "/a/:slug", destination: "/first/:slug" },
      { source: "/a/b", destination: "/second" },
    ]);

    expect(match("/a/b")).toEqual({ destination: "/first/b", permanent: true });
  });
});
