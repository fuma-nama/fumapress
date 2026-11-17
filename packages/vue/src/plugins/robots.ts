import type { Plugin } from "../core/plugin";

export interface RobotsOptions {
  /** the path of the sitemap, `false` for none @defaultValue "/sitemap.xml" */
  sitemap?: string | false;
}

/** `/robots.txt` allowing every crawler, generated at build time */
export function robotsPlugin({ sitemap = "/sitemap.xml" }: RobotsOptions = {}): Plugin {
  return {
    name: "core:robots",
    routes({ createApi }) {
      createApi({
        path: "/robots.txt",
        render: "static",
        GET: () => {
          const lines = ["User-agent: *", "Allow: /"];
          // a sitemap is referenced by its full URL
          if (sitemap && this.site.baseUrl) lines.push("", `Sitemap: ${this.absoluteUrl(sitemap)}`);
          return new Response(`${lines.join("\n")}\n`, {
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        },
      });
    },
  };
}
