import { describe, expect, it } from "vitest";
import { localizePath } from "@/lib/i18n";

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
