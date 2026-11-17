import { escapeHtml } from "../core/head";
import type { AppShape, Plugin } from "../core/plugin";
import { hasParams } from "../core/routes";

export interface SitemapOptions<C extends AppShape = AppShape> {
  /** @defaultValue "/sitemap.xml" */
  path?: string;
  /** the content pages to list: a page it returns `false` for is left out */
  filter?: (page: C["page"]) => boolean;
}

/**
 * `/sitemap.xml` with every page generated ahead: the content pages of each language with their translations, the
 * views with theirs and the custom pages without params. Generated at build time, or on demand with a dynamic source.
 * A sitemap lists full URLs, so a site has one with `site.baseUrl` only.
 */
export function sitemapPlugin<C extends AppShape = AppShape>({
  path = "/sitemap.xml",
  filter,
}: SitemapOptions<NoInfer<C>> = {}): Plugin<C> {
  return {
    name: "core:sitemap",
    routes({ createApi }) {
      if (!this.site.baseUrl) return;
      createApi({
        path,
        render: this.getContentRender(),
        GET: async () => {
          // a page shown in the fallback language has the URL of that language's page
          const listed = this.getPages().filter(
            (page) => !this.getFallbackOrigin(page) && (filter?.(page) ?? true),
          );
          const content = new Set(this.getPages().map((page) => page.url));
          // the views without params, whatever their render, and the pages generated ahead
          const others = new Set(
            [
              ...(await this.getStaticPages()),
              ...this.views.flatMap(({ path }) => (hasParams(path) ? [] : [path])),
              ...this.customPages,
            ].filter((url) => !content.has(url)),
          );
          const urls = new Set([...listed.map((page) => page.url), ...others]);

          const entry = (url: string, alternates: { lang: string; url: string }[], more = "") => {
            // a translation left out is not an alternate either
            const links = alternates
              .filter((alternate) => urls.has(alternate.url))
              .map(
                ({ lang, url }) =>
                  `<xhtml:link rel="alternate" hreflang="${escapeHtml(lang)}" href="${escapeHtml(this.absoluteUrl(url))}"/>`,
              )
              .join("");
            return `  <url><loc>${escapeHtml(this.absoluteUrl(url))}</loc>${more}${links}</url>`;
          };
          const ofContent = await Promise.all(
            listed.map(async (page) => {
              const modified = await this.getPageLastModified(page);
              const lastmod = modified ? `<lastmod>${modified.toISOString()}</lastmod>` : "";
              return entry(page.url, this.getPageAlternates(page), lastmod);
            }),
          );
          const ofOthers = [...others].map((url) => entry(url, this.getViewAlternates(url)));

          return new Response(
            `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${[...ofContent, ...ofOthers].join("\n")}\n</urlset>\n`,
            { headers: { "Content-Type": "application/xml; charset=utf-8" } },
          );
        },
      });
    },
    build() {
      if (!this.site.baseUrl) {
        console.warn(
          `[Fumapress] No ${path}: a sitemap lists full URLs, so it needs \`site.baseUrl\`, the origin of the deployed site, like "https://docs.example.com".`,
        );
      }
    },
  };
}
