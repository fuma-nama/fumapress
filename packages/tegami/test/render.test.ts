import { describe, expect, it } from "vitest";
import type { WorkspacePackage } from "tegami";
import { renderEntryMdx } from "../src/render.ts";

describe("renderEntryMdx", () => {
  it("renders frontmatter and sections", () => {
    const sample = renderEntryMdx(
      () => [{ name: "fumapress", version: "1.2.3" } as WorkspacePackage],
      {
        id: "2026-07-09-abc.md",
        filename: "2026-07-09-abc.md",
        packages: new Map([["fumapress", { type: "patch" }]]),
        sections: [{ depth: 2, title: "Fix hover", content: "Matches design system." }],
        getRawContent: () => "",
      },
      new Date("2026-07-10T15:30:00.000Z"),
    );

    expect(sample).toMatchInlineSnapshot(`
      "---
      title: Fix hover
      date: 2026-07-10T15:30:00.000Z
      packages:
        fumapress:
          version: 1.2.3
      ---

      ## Fix hover

      Matches design system.
      "
    `);
  });
});
