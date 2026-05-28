import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readMintlifyDocs } from "@/read-config";

function writeJson(filePath: string, value: unknown) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

describe("readMintlifyDocs", () => {
  it("reads and validates docs.json from disk", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "mintlify-read-config-"));
    writeJson(path.join(root, "docs.json"), {
      theme: "mint",
      name: "On Disk Docs",
      colors: { primary: "#000000" },
      navigation: { pages: ["intro"] },
    });

    const docs = readMintlifyDocs({ root, path: "docs.json" });

    expect(docs.name).toBe("On Disk Docs");
    expect(docs.navigation.pages).toEqual(["intro"]);
  });

  it("resolves local $ref files and merges sibling keys", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "mintlify-read-config-"));
    writeJson(path.join(root, "navigation.json"), {
      pages: ["intro"],
      groups: [{ group: "Guides", pages: ["setup"] }],
    });
    writeJson(path.join(root, "docs.json"), {
      theme: "mint",
      name: "Ref Docs",
      colors: { primary: "#000000" },
      navigation: {
        $ref: "./navigation.json",
        languages: [{ language: "en", default: true, pages: ["intro"] }],
      },
    });

    const docs = readMintlifyDocs({ root, path: "docs.json" });

    expect(docs.navigation.pages).toEqual(["intro"]);
    expect(docs.navigation.languages).toHaveLength(1);
    expect(docs.navigation.groups).toEqual([{ group: "Guides", pages: ["setup"] }]);
  });

  it("rejects $ref paths outside the project root", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "mintlify-read-config-"));
    writeJson(path.join(root, "docs.json"), {
      theme: "mint",
      name: "Unsafe Ref",
      colors: { primary: "#000000" },
      navigation: {
        $ref: "../../../etc/passwd",
      },
    });

    expect(() => readMintlifyDocs({ root, path: "docs.json" })).toThrow(
      "[Fumapress Mintlify] Invalid $ref path",
    );
  });
});
