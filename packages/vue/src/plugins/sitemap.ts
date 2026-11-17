import { escapeHtml } from "../core/head";
import type { Plugin } from "../core/plugin";

export interface SitemapOptions {
  /** @defaultValue "/sitemap.xml" */
  path?: string;
}

/**
 * `/sitemap.xml` with every page generated ahead: the content pages of each language with their translations, the
 * pages of plugins and the custom pages without params. Generated at build time, or on demand with a dynamic source.
 */
export function sitemapPlugin({ path = "/sitemap.xml" }: SitemapOptions = {}): Plugin {
  return {
    name: "core:sitemap",
    routes({ createApi }) {
      createApi({
        path,
        render: this.getContentRender(),
        GET: async () => {
          const loc = (url: string) => `<loc>${escapeHtml(this.absoluteUrl(url))}</loc>`;
          const ofContent = await Promise.all(
            this.getPages().map(async (page) => {
              const modified = await this.getPageLastModified(page);
              const lastmod = modified ? `<lastmod>${modified.toISOString()}</lastmod>` : "";
              const alternates = this.getPageAlternates(page)
                .map(
                  ({ lang, url }) =>
                    `<xhtml:link rel="alternate" hreflang="${escapeHtml(lang)}" href="${escapeHtml(this.absoluteUrl(url))}"/>`,
                )
                .join("");
              return `  <url>${loc(page.url)}${lastmod}${alternates}</url>`;
            }),
          );
          const content = new Set(this.getPages().map((page) => page.url));
          const ofViews = [...(await this.getStaticPages()), ...this.customPages]
            .filter((url) => !content.has(url))
            .map((url) => `  <url>${loc(url)}</url>`);

          return new Response(
            `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${[...ofContent, ...ofViews].join("\n")}\n</urlset>\n`,
            { headers: { "Content-Type": "application/xml; charset=utf-8" } },
          );
        },
      });
    },
  };
}
