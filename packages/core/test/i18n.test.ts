import { describe, expect, it } from "vitest";
import { localeRoutes, localizePath } from "@/lib/i18n";

const prefixed = { languages: ["en", "cn"], defaultLanguage: "en" };
const hidden = { ...prefixed, hideLocale: "default-locale" } as const;

describe("localizePath", () => {
  it("prefixes every language by default", () => {
    expect(localizePath(prefixed, "en", "/blog")).toBe("/en/blog");
    expect(localizePath(prefixed, "cn", "/")).toBe("/cn");
  });

  it("keeps the hidden default language unprefixed", () => {
    expect(localizePath(hidden, "en", "/blog")).toBe("/blog");
    expect(localizePath(hidden, "cn", "/blog")).toBe("/cn/blog");
  });

  it("leaves paths alone without i18n", () => {
    expect(localizePath(undefined, undefined, "/blog")).toBe("/blog");
    expect(localizePath(prefixed, undefined, "/blog")).toBe("/blog");
  });
});

describe("localeRoutes", () => {
  it("gives every language a prefix route", () => {
    expect(localeRoutes(prefixed)).toEqual([
      { base: "/en", lang: "en" },
      { base: "/cn", lang: "cn" },
    ]);
  });

  it("moves the hidden default language into the default group", () => {
    expect(localeRoutes(hidden)).toEqual([
      { base: "/(default)", lang: "en" },
      { base: "/cn", lang: "cn" },
    ]);
  });
});
