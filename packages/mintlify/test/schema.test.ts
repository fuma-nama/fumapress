import { describe, expect, it } from "vitest";
import { parseMintlifyDocsJson } from "@/schema";
import { fullDocs, minimalDocs } from "./fixtures/docs";

describe("parseMintlifyDocsJson", () => {
  it("parses a valid docs.json payload", () => {
    expect(parseMintlifyDocsJson(minimalDocs)).toEqual(minimalDocs);
  });

  it("parses a docs.json using the full feature surface", () => {
    expect(parseMintlifyDocsJson(fullDocs)).toEqual(fullDocs);
  });

  it("keeps unknown properties for forward compatibility", () => {
    const parsed = parseMintlifyDocsJson({
      ...minimalDocs,
      somethingNew: { hello: "world" },
    });

    expect(parsed).toMatchObject({ somethingNew: { hello: "world" } });
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
