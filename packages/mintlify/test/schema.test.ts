import { describe, expect, it } from "vitest";
import { parseMintlifyDocsJson } from "@/schema";
import { minimalDocs } from "./fixtures/docs";

describe("parseMintlifyDocsJson", () => {
  it("parses a valid docs.json payload", () => {
    expect(parseMintlifyDocsJson(minimalDocs)).toEqual(minimalDocs);
  });

  it("throws a readable error for invalid docs.json", () => {
    expect(() =>
      parseMintlifyDocsJson({
        theme: "mint",
        colors: { primary: "#000000" },
      }),
    ).toThrow("[Fumapress Mintlify] Invalid docs.json:\nname: Invalid input");
  });
});
