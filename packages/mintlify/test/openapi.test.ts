import path from "node:path";
import { describe, expect, it } from "vitest";
import { createMintlifyOpenAPI } from "@/openapi";
import { openapiDocs } from "./fixtures/docs";

const projectRoot = path.resolve("/tmp/fumapress-mintlify");

describe("createMintlifyOpenAPI", () => {
  it("wraps createOpenAPI with options from docs.json", () => {
    const server = createMintlifyOpenAPI({ _config: openapiDocs, root: projectRoot });

    expect(server.options.input).toEqual([
      path.join(projectRoot, "openapi/petstore.yaml"),
      path.join(projectRoot, "openapi/legacy.json"),
    ]);
    expect(server.options.proxyUrl).toBeUndefined();
  });

  it("allows overriding createOpenAPI options", () => {
    const server = createMintlifyOpenAPI({
      root: projectRoot,
      _config: openapiDocs,
      proxyUrl: "/custom-proxy",
    });

    expect(server.options.proxyUrl).toBe("/custom-proxy");
  });
});
