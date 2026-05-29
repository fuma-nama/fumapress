import { describe, expect, it } from "vitest";
import { getMintlifyLanguages } from "@/i18n";
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
