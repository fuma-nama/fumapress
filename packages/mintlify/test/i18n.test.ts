import { describe, expect, it, vi } from "vitest";
import {
  applyMintlifyTranslations,
  getMintlifyLanguages,
  mintlifyI18n,
  mintlifyLocaleToPress,
  pressLocaleToMintlify,
} from "@/i18n";
import { minimalDocs, multilingualDocs } from "./fixtures/docs";

describe("getMintlifyLanguages", () => {
  it("returns navigation.languages when present", () => {
    expect(getMintlifyLanguages(multilingualDocs)).toHaveLength(2);
  });

  it("falls back to navigation.global.languages", () => {
    const docs = {
      ...minimalDocs,
      navigation: {
        global: {
          languages: [{ language: "en", default: true, pages: [] }],
        },
      },
    };

    expect(getMintlifyLanguages(docs)).toEqual([{ language: "en", default: true, pages: [] }]);
  });

  it("returns an empty array when no languages are configured", () => {
    expect(getMintlifyLanguages(minimalDocs)).toEqual([]);
  });
});

describe("mintlifyLocaleToPress", () => {
  it("maps known Mintlify locale aliases", () => {
    expect(mintlifyLocaleToPress("zh-Hans")).toBe("cn");
    expect(mintlifyLocaleToPress("jp")).toBe("ja");
    expect(mintlifyLocaleToPress("fr-CA")).toBe("fr");
  });

  it("lowercases unknown locales", () => {
    expect(mintlifyLocaleToPress("sv-SE")).toBe("sv-se");
  });

  it("supports custom locale overrides", () => {
    expect(mintlifyLocaleToPress("zh-Hans", { localeMap: { "zh-Hans": "zh" } })).toBe("zh");
  });
});

describe("pressLocaleToMintlify", () => {
  it("returns the press locale when no languages are configured", () => {
    expect(pressLocaleToMintlify("en", minimalDocs)).toBe("en");
  });

  it("maps press locales back to Mintlify language codes", () => {
    expect(pressLocaleToMintlify("cn", multilingualDocs)).toBe("zh-Hans");
    expect(pressLocaleToMintlify("en", multilingualDocs)).toBe("en");
  });

  it("falls back to the default language", () => {
    expect(pressLocaleToMintlify("unknown", multilingualDocs)).toBe("en");
  });
});

describe("mintlifyI18n", () => {
  it("builds i18n config and translations from docs.json languages", () => {
    const bundle = mintlifyI18n(multilingualDocs);

    expect(bundle.i18n.defaultLanguage).toBe("en");
    expect(bundle.i18n.languages).toEqual(["en", "cn"]);
    expect(bundle.mapLocale("cn")).toBe("zh-Hans");
    expect(bundle.mapLocale(undefined)).toBe("en");
  });

  it("throws when docs.json has no languages", () => {
    expect(() => mintlifyI18n(minimalDocs)).toThrow(
      "[Fumapress Mintlify] docs.json does not define navigation.languages",
    );
  });
});

describe("applyMintlifyTranslations", () => {
  it("adds all language display names when translations config supports locales", () => {
    const add = vi.fn();
    const ctx = {
      translationsConfig: { config: {}, add },
    };

    applyMintlifyTranslations(ctx as never, multilingualDocs);

    expect(add).toHaveBeenCalledWith("ui", {
      en: { displayName: "English" },
      cn: { displayName: "Chinese (Simplified)" },
    });
  });

  it("adds only the default locale display name for legacy translation configs", () => {
    const add = vi.fn();
    const ctx = {
      translationsConfig: { add },
    };

    applyMintlifyTranslations(ctx as never, multilingualDocs);

    expect(add).toHaveBeenCalledWith("ui", { displayName: "English" });
  });

  it("no-ops when translations are not configured", () => {
    const ctx = { translationsConfig: undefined };

    expect(() => applyMintlifyTranslations(ctx as never, multilingualDocs)).not.toThrow();
  });
});
