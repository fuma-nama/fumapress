import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  assertMintlifyOpenAPI,
  hasOpenAPIPlugin,
  mintlifyOpenAPIOptions,
  mintlifyOpenAPISourceOptions,
  resolveMintlifyOpenAPIInput,
} from "@/openapi";
import { minimalDocs, openapiDocs } from "./fixtures/docs";

const projectRoot = path.resolve("/tmp/fumapress-mintlify");

describe("resolveMintlifyOpenAPIInput", () => {
  it("returns an empty array when api config is missing", () => {
    expect(resolveMintlifyOpenAPIInput(minimalDocs, { root: projectRoot })).toEqual([]);
  });

  it("resolves relative openapi and asyncapi sources", () => {
    expect(resolveMintlifyOpenAPIInput(openapiDocs, { root: projectRoot })).toEqual([
      path.join(projectRoot, "openapi/petstore.yaml"),
      path.join(projectRoot, "openapi/legacy.json"),
      path.join(projectRoot, "async/events.yaml"),
    ]);
  });
});

describe("mintlifyOpenAPIOptions", () => {
  it("maps docs.json api settings to OpenAPI plugin options", () => {
    expect(mintlifyOpenAPIOptions(openapiDocs, { root: projectRoot })).toEqual({
      input: [
        path.join(projectRoot, "openapi/petstore.yaml"),
        path.join(projectRoot, "openapi/legacy.json"),
        path.join(projectRoot, "async/events.yaml"),
      ],
      proxyUrl: undefined,
    });
  });
});

describe("mintlifyOpenAPISourceOptions", () => {
  it("uses the first openapi directory when present", () => {
    expect(mintlifyOpenAPISourceOptions(openapiDocs)).toEqual({
      baseDir: "api-reference",
      meta: true,
    });
  });

  it("falls back to meta-only options", () => {
    expect(mintlifyOpenAPISourceOptions(minimalDocs)).toEqual({ meta: true });
  });
});

describe("hasOpenAPIPlugin", () => {
  it("detects the core OpenAPI plugin", () => {
    expect(hasOpenAPIPlugin([{ name: "core:openapi" }])).toBe(true);
    expect(hasOpenAPIPlugin([{ name: "other" }])).toBe(false);
  });
});

describe("assertMintlifyOpenAPI", () => {
  it("warns when api config exists without the OpenAPI plugin", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    assertMintlifyOpenAPI(openapiDocs, [], { root: projectRoot });

    expect(warn).toHaveBeenCalledWith(
      "[Fumapress Mintlify] docs.json defines api.openapi/asyncapi but openapiPlugin() is not configured",
    );

    warn.mockRestore();
  });
});
