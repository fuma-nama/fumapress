import { escapeHtml } from "../core/head";
import type { Plugin } from "../core/plugin";
import type { Page } from "../core/types";

export interface SitemapOptions {
  /** @defaultValue "/sitemap.xml" */
  path?: string;
  /** the content pages to list: a page it returns `false` for is left out */
  filter?: (page: Page) => boolean;
}

/**
 * `/sitemap.xml` with every page generated ahead: the content pages of each language with their translations, the
 * pages of plugins and the custom pages without params. Generated at build time, or on demand with a dynamic source.
 */
export function sitemapPlugin({ path = "/sitemap.xml", filter }: SitemapOptions = {}): Plugin {
  return {
    name: "core:sitemap",
    routes({ createApi }) {
      createApi({
        path,
        render: this.getContentRender(),
        GET: async () => {
          const loc = (url: string) => `<loc>${escapeHtml(this.absoluteUrl(url))}</loc>`;
          const listed = this.getPages().filter((page) => filter?.(page) ?? true);
          const urls = new Set(listed.map((page) => page.url));
          const ofContent = await Promise.all(
            listed.map(async (page) => {
              const modified = await this.getPageLastModified(page);
              const lastmod = modified ? `<lastmod>${modified.toISOString()}</lastmod>` : "";
              // a translation left out is not an alternate either
              const alternates = this.getPageAlternates(page)
                .filter(({ url }) => urls.has(url))
                .map(
                  ({ lang, url }) =>
                    `<xhtml:link rel="alternate" hreflang="${escapeHtml(lang)}" href="${escapeHtml(this.absoluteUrl(url))}"/>`,
                )
                .join("");
              return `  <url>${loc(page.url)}${lastmod}${alternates}</url>`;
            }),
          );
          const content = new Set(this.getPages().map((page) => page.url));
          const others = [...(await this.getStaticPages()), ...this.customPages]
            .filter((url) => !content.has(url))
            .map((url) => `  <url>${loc(url)}</url>`);

          return new Response(
            `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${[...ofContent, ...others].join("\n")}\n</urlset>\n`,
            { headers: { "Content-Type": "application/xml; charset=utf-8" } },
          );
        },
      });
    },
  };
}
