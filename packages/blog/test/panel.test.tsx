import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { TOCProvider } from "fumadocs-ui/components/toc";
import type { TOCItemType } from "fumadocs-core/toc";
import { BlogPanel } from "@/components/panel.client";

function render(toc: TOCItemType[]) {
  return renderToString(
    <TOCProvider toc={toc}>
      <BlogPanel />
    </TOCProvider>,
  );
}

describe("BlogPanel", () => {
  it("shows the table of contents of a post with headings", () => {
    expect(render([{ title: "Intro", url: "#intro", depth: 2 }])).toContain("Table of Contents");
  });

  it("hides the table of contents of a post without headings", () => {
    const out = render([]);
    expect(out).not.toContain("Table of Contents");
    expect(out).toContain("Share");
  });
});
