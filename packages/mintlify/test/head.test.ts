import { describe, expect, it } from "vitest";
import { buildThemeCss, foregroundFor } from "@/features/head";
import type { MintlifyDocsJson } from "@/schema";

function docsWith(overrides: Partial<MintlifyDocsJson>): MintlifyDocsJson {
  return {
    theme: "mint",
    name: "Test",
    colors: { primary: "#16A34A" },
    navigation: { pages: [] },
    ...overrides,
  };
}

describe("foregroundFor", () => {
  it("picks white text on dark backgrounds", () => {
    expect(foregroundFor("#000000")).toBe("#ffffff");
    expect(foregroundFor("#16A34A")).toBe("#ffffff");
  });

  it("picks dark text on light backgrounds", () => {
    expect(foregroundFor("#ffffff")).toBe("#0a0a0a");
    expect(foregroundFor("#fff")).toBe("#0a0a0a");
  });
});

describe("buildThemeCss", () => {
  it("maps colors.primary and colors.light to fumadocs variables", () => {
    const css = buildThemeCss(docsWith({ colors: { primary: "#16A34A", light: "#4ADE80" } }));

    expect(css).toContain(":root{--color-fd-primary: #16A34A;");
    expect(css).toContain(".dark{--color-fd-primary: #4ADE80;");
  });

  it("falls back to primary in dark mode", () => {
    const css = buildThemeCss(docsWith({}));

    expect(css).toContain(".dark{--color-fd-primary: #16A34A;");
  });

  it("applies background colors and images", () => {
    const css = buildThemeCss(
      docsWith({
        background: {
          color: { light: "#ffffff", dark: "#000000" },
          image: { light: "/bg-light.png", dark: "/bg-dark.png" },
        },
      }),
    );

    expect(css).toContain("--color-fd-background: #ffffff;");
    expect(css).toContain("--color-fd-background: #000000;");
    expect(css).toContain('body{background-image:url("/bg-light.png")');
    expect(css).toContain('.dark body{background-image:url("/bg-dark.png")');
  });

  it("applies fonts for body and headings", () => {
    const css = buildThemeCss(docsWith({ fonts: { family: "Inter", weight: 500 } }));

    expect(css).toContain('body{font-family:"Inter"');
    expect(css).toContain('h1,h2,h3,h4,h5,h6{font-family:"Inter"');
    expect(css).toContain("font-weight:500");
  });

  it("generates @font-face for self-hosted fonts", () => {
    const css = buildThemeCss(
      docsWith({
        fonts: {
          body: { family: "Custom", source: "/fonts/custom.woff2", format: "woff2" },
        },
      }),
    );

    expect(css).toContain(
      '@font-face{font-family:"Custom";src:url("/fonts/custom.woff2") format("woff2")',
    );
  });

  it("generates banner colors from the banner type", () => {
    const css = buildThemeCss(docsWith({ banner: { content: "hi", type: "warning" } }));

    expect(css).toContain(".mintlify-banner{background-color:#d97706");
  });

  it("uses the primary color for info banners", () => {
    const css = buildThemeCss(docsWith({ banner: { content: "hi" } }));

    expect(css).toContain(".mintlify-banner{background-color:#16A34A");
  });
});
