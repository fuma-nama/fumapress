import { isMarkdownPreferred } from "fumadocs-core/negotiation";
import { llms } from "fumadocs-core/source/llms";
import { fallbackOrigin, joinPaths, type Context } from "../context";
import type { AppShape, Awaitable, Plugin } from "../plugin";
import { stripBase } from "../routes";

export interface LLMsOptions<C extends AppShape = AppShape> {
  /**
   * Serve the Markdown of a page to requests preferring it (`Accept: text/markdown`), on pages rendered on request.
   *
   * @defaultValue true
   */
  autoRedirect?: boolean;

  /**
   * The Markdown of a page, pages without it are left out of `llms-full.txt`.
   *
   * By default, the text of content sources under a heading with the title and URL of the page.
   */
  getLLMText?: (this: Context<C>, page: C["page"]) => Awaitable<string | undefined>;

  /**
   * Which pages get a Markdown version (`/page.md`, `/index.md` for the root):
   *
   * - `"content"`: the pages of your content sources.
   * - `"all"`: also the page routes whose `markdown()` gives text (on Waku, pages calling `asMarkdown()`). Static pages
   *   are prerendered, pages rendered on request render it on request.
   *
   * The Markdown renders the page without its layouts: access checks of a page belong in the page itself, or in
   * middleware that covers its `<page>.md` too. Static pages render while the routes are created, they can read
   * `getRoutes()` and the base options.
   *
   * @defaultValue "content"
   */
  routes?: "content" | "all";
}

/** the routes mirroring the dynamic page routes, they render their Markdown */
const mirrorPath = "/_llms.txt";

/** the path of the Markdown of a page: `<page>.md`, `/index.md` for the root */
function markdownPath(url: string): string {
  return url === "/" ? "/index.md" : `${url}.md`;
}

function markdownResponse(text: string): Response {
  return new Response(text, { headers: { "Content-Type": "text/markdown; charset=utf-8" } });
}

/** a copy of `response` that caches key on `Accept`, the headers of responses like `Response.redirect()` are immutable */
function varyAccept(response: Response): Response {
  const out = new Response(response.body, response);
  out.headers.append("Vary", "Accept");
  return out;
}

/**
 * `llms.txt`, `llms-full.txt` and the Markdown of pages: `/docs/page.md`, `/index.md` for the root page.
 *
 * Pages rendered on request serve their Markdown to requests preferring it (`Accept: text/markdown`).
 */
export function llmsPlugin<C extends AppShape = AppShape>(
  options: LLMsOptions<NoInfer<C>> = {},
): Plugin<C, { provides: "llms" }> {
  const {
    autoRedirect = true,
    routes = "content",
    getLLMText = async function (page) {
      const text = await this.getPageText(page);
      if (text !== undefined)
        return `# ${page.data.title} (${this.absoluteUrl(page.url)})\n\n${text}`;
    },
  } = options;

  async function markdown(ctx: Context<C>, page: C["page"]): Promise<Response> {
    return markdownResponse((await getLLMText.call(ctx, page)) ?? "");
  }

  /** the mirror paths of the rewrites in flight: the mirrors serve the `<page>.md` URLs only, never a request of their own */
  const rewrites = new Map<string, number>();

  return {
    name: "core:llms.txt",
    provides: ["llms"],
    transformPage(data) {
      return { markdownUrl: this.withBase(markdownPath(data.url)) };
    },
    async routes({ createApi }) {
      createApi({
        path: "/llms.txt",
        render: "static",
        GET: async () =>
          new Response(
            llms(await this.getLoader(), {
              renderUrl: (item) => this.absoluteUrl(item.url),
            }).index(),
          ),
      });
      createApi({
        path: "/llms-full.txt",
        render: "static",
        GET: async () => {
          const source = await this.getLoader();
          const pending: Awaitable<string | undefined>[] = [];
          for (const page of source.getPages()) {
            if (!fallbackOrigin(source, this.i18nConfig, page))
              pending.push(getLLMText.call(this, page));
          }

          const texts: string[] = [];
          for (const text of await Promise.all(pending)) if (text !== undefined) texts.push(text);
          return new Response(texts.join("\n\n"));
        },
      });
      // the middleware serves them, from the pages of revalidated sources
      if (this.mode === "dynamic") return;

      // a route per file, a catch-all route would take the paths of pages
      for (const page of (await this.getLoader()).getPages()) {
        createApi({
          path: markdownPath(page.url),
          render: "static",
          GET: () => markdown(this, page),
        });
      }
    },
    async deriveRoutes({ createApi }, { lang, routes: pageRoutes }) {
      if (routes !== "all") return;
      // content pages keep their own Markdown
      const markdownPaths = new Set<string>();
      for (const page of (await this.getLoader()).getPages(lang))
        markdownPaths.add(markdownPath(page.url));

      for (const route of pageRoutes) {
        const render = route.markdown?.bind(route);
        if (!render) continue;
        if (route.render === "dynamic") {
          createApi({
            path: joinPaths(mirrorPath, route.path),
            async GET(request, { params }) {
              const { pathname } = new URL(request.url);
              const text = await render(
                pathname.slice(pathname.indexOf(mirrorPath) + mirrorPath.length) || "/",
                params,
              );
              return text === undefined
                ? new Response(null, { status: 404 })
                : markdownResponse(text);
            },
          });
          continue;
        }

        // a static route that 404s would fail the build: only pages with a Markdown form get one
        for (const page of route.pages) {
          const path = markdownPath(page.path);
          if (markdownPaths.has(path)) continue;
          const text = await render(page.path, page.params);
          if (text === undefined) continue;
          markdownPaths.add(path);
          createApi({ path, render: "static", GET: () => markdownResponse(text) });
        }
      }
    },
    async middleware(request, next) {
      if (this.mode === "static" || request.method !== "GET") return next();
      const path = stripBase(new URL(request.url).pathname, this.withBase("/"));
      if (path === undefined) return next();
      if (path.startsWith(`${mirrorPath}/`))
        return rewrites.has(path) ? next() : new Response(null, { status: 404 });

      if (path.endsWith(".md")) {
        const url = path === "/index.md" ? "/" : path.slice(0, -3);
        // the other modes prerender them
        if (this.mode === "dynamic") {
          const page = (await this.getLoader()).getPageByUrl(url);
          if (page) return markdown(this, page);
        }

        const response = await next();
        if (routes !== "all" || response.headers.get("Content-Type")?.startsWith("text/markdown"))
          return response;
        // a page rendered on request: its route mirroring the page renders the Markdown
        const mirror = joinPaths(mirrorPath, url);
        rewrites.set(mirror, (rewrites.get(mirror) ?? 0) + 1);
        try {
          const mirrored = await next(mirror);
          return mirrored.ok ? mirrored : response;
        } finally {
          const count = rewrites.get(mirror)! - 1;
          if (count === 0) rewrites.delete(mirror);
          else rewrites.set(mirror, count);
        }
      }
      if (!autoRedirect) return next();

      // both forms are negotiable, caches must key on `Accept`, and caches ignoring it keep the HTML
      if (isMarkdownPreferred(request)) {
        // like `trailingSlash: 'always'`
        const response = await next(markdownPath(path.replace(/(.)\/$/, "$1")));
        if (response.ok) {
          const out = varyAccept(response);
          out.headers.set("Cache-Control", "private");
          return out;
        }
      }

      const response = await next();
      return response.headers.get("Content-Type")?.startsWith("text/html")
        ? varyAccept(response)
        : response;
    },
  };
}
