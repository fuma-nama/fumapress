import { describe, expect, it } from "vitest";
import { createMintlifyPressConfig } from "@/index";
import { minimalDocs, multilingualDocs, openapiDocs } from "./fixtures/docs";

describe("createMintlifyPressConfig", () => {
  it("returns OpenAPI helpers without i18n when languages are absent", () => {
    const config = createMintlifyPressConfig(openapiDocs);

    expect(config.i18n).toBeUndefined();
    expect(config.translations).toBeUndefined();
    expect(config.openapi.input).toHaveLength(3);
    expect(config.openapiSource).toEqual({
      baseDir: "api-reference",
      meta: true,
    });
    expect(config.openapiInput).toHaveLength(3);
  });

  it("returns i18n and translations when languages are configured", () => {
    const config = createMintlifyPressConfig(multilingualDocs);

    expect(config.i18n?.defaultLanguage).toBe("en");
    expect(config.translations).toBeDefined();
    expect(config.openapi.input).toBeUndefined();
  });

  it("returns empty OpenAPI input for docs without api config", () => {
    const config = createMintlifyPressConfig(minimalDocs);

    expect(config.openapi.input).toBeUndefined();
    expect(config.openapiInput).toEqual([]);
  });
});
