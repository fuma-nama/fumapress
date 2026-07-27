import type { PressPlugin } from "@/app/plugin";
import type { AppShape } from "@/app/context";

/**
 * A group of rules in `robots.txt`.
 *
 * @see https://developers.google.com/search/docs/crawling-indexing/robots/create-robots-txt
 */
export interface RobotsRule {
  /**
   * crawler(s) the rule applies to
   *
   * @default "*"
   */
  userAgent?: string | string[];

  allow?: string | string[];
  disallow?: string | string[];
  crawlDelay?: number;
}

export interface RobotsOptions {
  /**
   * path of the robots.txt route
   *
   * @default "/robots.txt"
   */
  path?: string;

  /**
   * @default [{ userAgent: "*", allow: "/" }]
   */
  rules?: RobotsRule[];

  /**
   * Reference the sitemap:
   *
   * - `string`: URL (or path relative to `site.baseUrl`) of the sitemap.
   * - `true`: reference `/sitemap.xml`.
   * - `false`: don't reference a sitemap.
   *
   * By default, references `/sitemap.xml` only when the sitemap plugin is added.
   */
  sitemap?: string | boolean;

  /** raw content appended to the output */
  additionalContent?: string;
}

function ruleToText(rule: RobotsRule): string {
  const lines: string[] = [];
  const userAgents = Array.isArray(rule.userAgent) ? rule.userAgent : [rule.userAgent ?? "*"];
  const allow = Array.isArray(rule.allow) ? rule.allow : rule.allow ? [rule.allow] : [];
  const disallow = Array.isArray(rule.disallow)
    ? rule.disallow
    : rule.disallow
      ? [rule.disallow]
      : [];

  for (const userAgent of userAgents) lines.push(`User-agent: ${userAgent}`);
  for (const path of allow) lines.push(`Allow: ${path}`);
  for (const path of disallow) lines.push(`Disallow: ${path}`);
  if (rule.crawlDelay !== undefined) lines.push(`Crawl-delay: ${rule.crawlDelay}`);

  return lines.join("\n");
}

export function robotsPlugin<C extends AppShape = AppShape>(
  options: RobotsOptions = {},
): PressPlugin<C> {
  const {
    path = "/robots.txt",
    rules = [{ userAgent: "*", allow: "/" }],
    additionalContent,
  } = options;
  let sitemap = options.sitemap ?? false;

  return {
    name: "core:robots",
    init() {
      if (options.sitemap === undefined) {
        sitemap = this.plugins.some((item) => item.name === "core:sitemap");
      }
    },
    createPages({ createApiIsomorphic }) {
      const renderMode = this.mode === "default" ? "static" : this.mode;

      createApiIsomorphic({
        render: renderMode,
        path,
        handler: async () => {
          const sections = rules.map(ruleToText);

          if (sitemap) {
            const sitemapPath = typeof sitemap === "string" ? sitemap : "/sitemap.xml";
            sections.push(
              `Sitemap: ${this.siteConfig.baseUrl ? new URL(sitemapPath, this.siteConfig.baseUrl).href : sitemapPath}`,
            );
          }
          if (additionalContent) sections.push(additionalContent);

          return new Response(sections.join("\n\n"), {
            headers: {
              "Content-Type": "text/plain",
            },
          });
        },
      });
    },
  };
}
