import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderToReadableStream } from "react-dom/server.edge";
import { appContext } from "@/app/context";
import { createApp, i18n } from "./fixtures";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("renderPageMeta", () => {
  it("renders the head tags as React elements: page, `meta`, then plugins", async () => {
    const ctx = await createApp({
      i18n,
      meta: {
        root: () => createElement("meta", { name: "root" }),
        page: () => createElement("meta", { name: "custom", content: "yes" }),
      },
      plugins: [{ head: () => [{ tag: "meta", attrs: { name: "plugin" } }] }],
    });
    const page = (await ctx.getLoader()).getPage(["docs", "basics"], "en")!;
    const render = (node: ReactNode) =>
      appContext.run(ctx, async () => {
        const stream = await renderToReadableStream(node);
        await stream.allReady;
        return new Response(stream).text();
      });

    const html = await render(ctx.renderPageMeta(page));
    expect(html).toContain("<title>docs/basics.mdx</title>");
    expect(html).toContain('<link rel="canonical" href="https://example.com/en/docs/basics"/>');
    expect(html).toContain(
      '<link rel="alternate" hrefLang="cn" href="https://example.com/cn/docs/basics"/>',
    );
    expect(html.indexOf("x-default")).toBeLessThan(html.indexOf('name="custom"'));
    expect(html.indexOf('name="custom"')).toBeLessThan(html.indexOf('name="plugin"'));
    await expect(render(await ctx.renderRootMeta())).resolves.toBe(
      '<meta name="plugin"/><meta name="root"/>',
    );
  });
});

describe("site.baseUrl", () => {
  it("warns when unset, and falls back to the development server", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubEnv("FUMAPRESS_PLATFORM", "cloudflare");
    const ctx = await createApp({ site: { baseUrl: undefined } });

    expect(warn).toHaveBeenCalledExactlyOnceWith(
      '[Fumapress] "site.baseUrl" is not set and Cloudflare Workers Builds does not expose the site URL; sitemap and RSS will fall back to relative URLs.',
    );
    expect(ctx.siteConfig.baseUrl).toBe("http://localhost:3000");
  });
});
