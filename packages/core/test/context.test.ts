import { describe, expect, it } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderToReadableStream } from "react-dom/server.edge";
import type { Page } from "fumadocs-core/source";
import { appContext, getFileLocale, type AppContext } from "@/app/context";
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

describe("getFileLocale", () => {
  const page = (path: string) => ({ path }) as Page;
  const dir = { ...i18n, parser: "dir" as const };

  it("parses locales like fumadocs", () => {
    expect(getFileLocale(page("docs/basics.mdx"), i18n)).toBe("en");
    expect(getFileLocale(page("docs/basics.cn.mdx"), i18n)).toBe("cn");
    expect(getFileLocale(page("docs/v1.2.mdx"), i18n)).toBe("en");
    expect(getFileLocale(page("docs/basics.$.mdx"), i18n)).toBeUndefined();

    expect(getFileLocale(page("docs/basics.mdx"), dir)).toBe("en");
    expect(getFileLocale(page("cn/docs/basics.mdx"), dir)).toBe("cn");
    expect(getFileLocale(page("$/docs/basics.mdx"), dir)).toBeUndefined();
    expect(getFileLocale(page("docs/basics.cn.mdx"), undefined)).toBeUndefined();
  });
});

describe("isFallbackPage", () => {
  it("detects pages inherited from the fallback language", async () => {
    const ctx = await createApp({ i18n });

    expect(ctx.isFallbackPage(await getPage(ctx, ["docs", "basics"], "en"))).toBe(false);
    expect(ctx.isFallbackPage(await getPage(ctx, ["docs", "basics"], "cn"))).toBe(false);
    expect(ctx.isFallbackPage(await getPage(ctx, ["docs", "only-en"], "en"))).toBe(false);
    expect(ctx.isFallbackPage(await getPage(ctx, ["docs", "only-en"], "cn"))).toBe(true);
    expect(ctx.isFallbackPage(await getPage(ctx, ["docs", "shared"], "cn"))).toBe(false);
  });

  it("is false without i18n", async () => {
    const ctx = await createApp();

    expect(ctx.isFallbackPage(await getPage(ctx, ["docs", "only-en"]))).toBe(false);
  });
});

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

  it("strips trailing slashes when disabled", async () => {
    const ctx = await createApp({ site: { trailingSlash: false } });

    await appContext.run(ctx, () => {
      expect(ctx.absoluteUrl("/docs/basics/")).toBe("https://example.com/docs/basics");
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
