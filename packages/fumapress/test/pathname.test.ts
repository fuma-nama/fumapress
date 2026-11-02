import { describe, expect, it } from "vitest";
import { joinPaths } from "@/lib/pathname";

describe("joinPaths", () => {
  it("keeps the first path as-is", () => {
    expect(joinPaths("/repo/", "/api/search")).toBe("/repo/api/search");
    expect(joinPaths("https://example.com/repo", "/index.webp")).toBe(
      "https://example.com/repo/index.webp",
    );
  });

  it("skips empty, `.` segments and trailing slashes", () => {
    expect(joinPaths("/", "en", "/docs/")).toBe("/en/docs");
    expect(joinPaths("/", "/")).toBe("/");
    expect(joinPaths("/_llms.txt", "")).toBe("/_llms.txt");
    expect(joinPaths("/", "./", "/api/search")).toBe("/api/search");
  });
});
