import { describe, expect, it } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderToReadableStream } from "react-dom/server.edge";
import { appContext, type AppContext } from "@/app/context";
import { createApp, i18n } from "./fixtures";

async function getPage(ctx: AppContext, slugs: string[], lang?: string) {
  const page = (await ctx.getLoader()).getPage(slugs, lang);
  if (!page) throw new Error(`missing page ${slugs.join("/")} (${lang})`);
  return page;
}

function render(ctx: AppContext, node: () => ReactNode) {
  return appContext.run(ctx, async () => {
    const stream = await renderToReadableStream(node());
    await stream.allReady;
    return new Response(stream).text();
  });
}

describe("absoluteUrl", () => {
  it("applies the trailing slash policy to page URLs only", async () => {
    const ctx = await createApp({ site: { trailingSlash: true } });

    await appContext.run(ctx, () => {
      expect(ctx.absoluteUrl("/docs/basics")).toBe("https://example.com/docs/basics/");
      expect(ctx.absoluteUrl("/")).toBe("https://example.com/");
      expect(ctx.absoluteUrl("/docs/basics.webp", { file: true })).toBe(
        "https://example.com/docs/basics.webp",
      );
    });
  });

  it("returns the pathname without baseUrl", async () => {
    const ctx = await createApp();
    ctx.siteConfig.baseUrl = undefined;

    await appContext.run(ctx, () => {
      expect(ctx.absoluteUrl("/docs/basics")).toBe("/docs/basics");
    });
  });
});

describe("getPageAlternates", () => {
  it("lists translations with their hreflang", async () => {
    const ctx = await createApp({ i18n, site: { hreflang: { cn: "zh-Hans" } } });
    const page = await getPage(ctx, ["docs", "basics"], "en");

    await expect(appContext.run(ctx, () => ctx.getPageAlternates(page))).resolves.toEqual([
      { locale: "en", hreflang: "en", href: "https://example.com/en/docs/basics" },
      { locale: "cn", hreflang: "zh-Hans", href: "https://example.com/cn/docs/basics" },
    ]);
  });

  it("is empty for pages without translations", async () => {
    const ctx = await createApp({ i18n });

    for (const lang of ["en", "cn"]) {
      const page = await getPage(ctx, ["docs", "only-en"], lang);
      await expect(appContext.run(ctx, () => ctx.getPageAlternates(page))).resolves.toEqual([]);
    }
  });
});

describe("renderPageMeta", () => {
  it("emits description, Open Graph, canonical and hreflang tags", async () => {
    const ctx = await createApp({
      i18n,
      meta: { page: () => createElement("meta", { name: "custom", content: "yes" }) },
    });
    const page = await getPage(ctx, ["docs", "basics"], "en");
    const html = await render(ctx, () => ctx.renderPageMeta(page));

    expect(html).toContain("<title>docs/basics.mdx</title>");
    expect(html).toContain('<meta name="description" content="About docs/basics.mdx"/>');
    expect(html).toContain('<meta property="og:title" content="docs/basics.mdx"/>');
    expect(html).toContain('<meta property="og:site_name" content="Fumapress"/>');
    expect(html).toContain('<link rel="canonical" href="https://example.com/en/docs/basics"/>');
    expect(html).toContain(
      '<meta property="og:url" content="https://example.com/en/docs/basics"/>',
    );
    expect(html).toContain(
      '<link rel="alternate" hrefLang="cn" href="https://example.com/cn/docs/basics"/>',
    );
    expect(html).toContain(
      '<link rel="alternate" hrefLang="x-default" href="https://example.com/en/docs/basics"/>',
    );
    expect(html).toContain('<meta name="custom" content="yes"/>');
    expect(html).not.toContain("noindex");
  });

  it("marks fallback pages noindex with a canonical to the source page", async () => {
    const ctx = await createApp({ i18n });
    const page = await getPage(ctx, ["docs", "only-en"], "cn");
    const html = await render(ctx, () => ctx.renderPageMeta(page));

    expect(html).toContain('<meta name="robots" content="noindex"/>');
    expect(html).toContain('<link rel="canonical" href="https://example.com/en/docs/only-en"/>');
    expect(html).not.toContain("hrefLang");
  });

  it("skips canonical without baseUrl", async () => {
    const ctx = await createApp();
    ctx.siteConfig.baseUrl = undefined;
    const page = await getPage(ctx, ["docs", "basics"]);
    const html = await render(ctx, () => ctx.renderPageMeta(page));

    expect(html).not.toContain("canonical");
    expect(html).not.toContain("og:url");
  });
});
