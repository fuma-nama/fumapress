import type { AppShape, Plugin } from "../plugin";

/**
 * A group of rules in `robots.txt`.
 *
 * @see https://developers.google.com/search/docs/crawling-indexing/robots/create-robots-txt
 */
export interface RobotsRule {
  /**
   * crawler(s) the rule applies to
   *
   * @defaultValue "*"
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
   * @defaultValue "/robots.txt"
   */
  path?: string;

  /**
   * @defaultValue [{ userAgent: "*", allow: "/" }]
   */
  rules?: RobotsRule[];

  /**
   * URL (or path relative to `site.baseUrl`) of the sitemap, `false` to reference none
   *
   * @defaultValue "/sitemap.xml"
   */
  sitemap?: string | false;

  /** raw content appended to the output */
  additionalContent?: string;
}

function lines(name: string, values: string | string[] | undefined): string[] {
  if (values === undefined) return [];
  const out: string[] = [];
  for (const value of typeof values === "string" ? [values] : values) out.push(`${name}: ${value}`);
  return out;
}

function ruleToText(rule: RobotsRule): string {
  const out = [
    ...lines("User-agent", rule.userAgent ?? "*"),
    ...lines("Allow", rule.allow || undefined),
    ...lines("Disallow", rule.disallow || undefined),
  ];
  if (rule.crawlDelay !== undefined) out.push(`Crawl-delay: ${rule.crawlDelay}`);
  return out.join("\n");
}

export function robotsPlugin<C extends AppShape = AppShape>(
  options: RobotsOptions = {},
): Plugin<C> {
  const {
    path = "/robots.txt",
    rules = [{ userAgent: "*", allow: "/" }],
    sitemap = "/sitemap.xml",
    additionalContent,
  } = options;

  return {
    name: "core:robots",
    routes({ createApi }) {
      createApi({
        path,
        render: "static",
        GET: () => {
          const sections = rules.map(ruleToText);
          if (sitemap !== false) sections.push(`Sitemap: ${this.absoluteUrl(sitemap)}`);
          if (additionalContent) sections.push(additionalContent);

          return new Response(sections.join("\n\n"), {
            headers: { "Content-Type": "text/plain" },
          });
        },
      });
    },
  };
}
