import { isMarkdownPreferred } from "fumadocs-core/negotiation";
import { llms } from "fumadocs-core/source/llms";
import type { Context } from "../context";
import type { AppShape, Awaitable, Plugin } from "../plugin";
import { joinPaths, matchPageRoute, stripBase, type PageRoute } from "../routes";

export interface LLMsOptions<C extends AppShape = AppShape> {
  /**
   * Serve the Markdown of a page to requests preferring it (`Accept: text/markdown`), on pages your server handles:
   * hosts serving prerendered pages before it, like Vercel, Netlify and Cloudflare, only negotiate pages rendered on demand.
   *
   * @defaultValue true
   */
  autoRedirect?: boolean;

  /**
   * The Markdown of a page, pages without it or with `noindex` in their page data are left out of `llms-full.txt`.
   *
   * By default, the text of content sources under a heading with the title and URL of the page.
   */
  getLLMText?: (this: Context<C>, page: C["page"]) => Awaitable<string | undefined>;

  /**
   * Which pages get a Markdown version (`/page.md`, `/index.md` for the root):
   *
   * - `"content"`: the pages of your content sources.
   * - `"all"`: also the page routes whose `markdown()` gives text, like pages calling `asMarkdown()`. Static pages
   *   are prerendered, pages rendered on demand render it on demand.
   *
   * The Markdown renders the page without its layouts: access checks of a page belong in the page itself, or in
   * middleware that covers its `<page>.md` too. Static pages render while the routes are created, they can read
   * `getPageRoutes()` and the layout props.
   *
   * @defaultValue "content"
   */
  routes?: "content" | "all";
}

/** the route mirroring the `<page>.md` URLs of the page routes rendered on demand, it renders their Markdown */
const mirrorPath = "/_llms.txt";

/** the path of the Markdown of a page: `<page>.md`, `/index.md` for the root */
function markdownPath(url: string): string {
  return url === "/" ? "/index.md" : `${url}.md`;
}

/** the URL of the page of a Markdown path */
function pageUrl(path: string): string {
  return path === "/index.md" ? "/" : path.slice(0, -3);
}

function markdownResponse(text: string, cacheControl?: string): Response {
  const headers = new Headers({ "Content-Type": "text/markdown; charset=utf-8" });
  if (cacheControl) headers.set("Cache-Control", cacheControl);
  return new Response(text, { headers });
}

/** a copy of `response` that caches key on `Accept`, the headers of responses like `Response.redirect()` are immutable */
function varyAccept(response: Response): Response {
  const out = new Response(response.body, response);
  if (!/(^|,)\s*accept\s*(,|$)/i.test(out.headers.get("Vary") ?? ""))
    out.headers.append("Vary", "Accept");
  return out;
}

/**
 * `llms.txt`, `llms-full.txt` and the Markdown of pages: `/docs/page.md`, `/index.md` for the root page.
 *
 * Pages your server handles serve their Markdown to requests preferring it (`Accept: text/markdown`).
 */
export function llmsPlugin<C extends AppShape = AppShape>(
  options: LLMsOptions<NoInfer<C>> = {},
): Plugin<C> {
  const {
    autoRedirect = true,
    routes = "content",
    getLLMText = async function (page) {
      const [text, { title }] = await Promise.all([this.getPageText(page), this.getPageData(page)]);
      if (text !== undefined) return `# ${title} (${this.absoluteUrl(page.url)})\n\n${text}`;
    },
  } = options;

  async function markdown(ctx: Context<C>, page: C["page"]): Promise<Response> {
    return markdownResponse((await getLLMText.call(ctx, page)) ?? "", ctx.getCacheControl(page));
  }

  /** the mirror paths of the rewrites in flight, each with an unguessable segment: the mirrors serve the `<page>.md` URLs only, never a request of their own */
  const rewrites = new Set<string>();
  /** the paths of the pages of static page routes with a Markdown file */
  const staticMarkdown = new Set<string>();

  const mirrorBase = (lang: string | undefined) => joinPaths(mirrorPath, lang ?? "");
  const hasMirror = (route: PageRoute) =>
    route.render === "dynamic" && route.markdown !== undefined;

  return {
    name: "core:llms.txt",
    transformPage(data, { page, route, path }) {
      const markdown =
        page ||
        (route?.render === "dynamic"
          ? hasMirror(route) && routes === "all"
          : path !== undefined && staticMarkdown.has(path));
      if (markdown) return { markdownUrl: markdownPath(data.url) };
    },
    async routes({ createApi }) {
      createApi({
        path: "/llms.txt",
        render: this.getContentRender(),
        GET: async () =>
          new Response(
            llms(await this.getLoader(), {
              renderUrl: (item) => this.absoluteUrl(item.url),
            }).index(),
          ),
      });
      createApi({
        path: "/llms-full.txt",
        render: this.getContentRender(),
        GET: async () => {
          const results = await Promise.all(
            (await this.getLoader())
              .getPages()
              .map(async (page) =>
                (await this.getPageData(page)).noindex ? undefined : getLLMText.call(this, page),
              ),
          );
          const texts: string[] = [];
          for (const text of results) if (text !== undefined) texts.push(text);
          return new Response(texts.join("\n\n"));
        },
      });
      // a route per file, a catch-all route would take the paths of pages; the middleware serves the pages of dynamic sources
      for (const page of (await this.getLoader()).getPages()) {
        if (this.getContentRender(page.type) === "dynamic") continue;
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

      let hasDynamic = false;
      for (const route of pageRoutes) {
        const render = route.markdown?.bind(route);
        if (!render) continue;
        if (route.render === "dynamic") {
          hasDynamic = true;
          continue;
        }

        // a static route that 404s would fail the build: only pages with a Markdown form get one
        for (const page of route.pages) {
          const path = markdownPath(page.path);
          if (markdownPaths.has(path)) continue;
          const text = await render(page.path, page.params);
          if (text === undefined) continue;
          markdownPaths.add(path);
          staticMarkdown.add(page.path);
          createApi({ path, render: "static", GET: () => markdownResponse(text) });
        }
      }

      // the Markdown of pages rendered on demand
      if (!hasDynamic) return;
      const base = mirrorBase(lang);
      createApi({
        path: `${base}/[...path]`,
        GET: async (request) => {
          const { pathname } = new URL(request.url);
          const path = pathname.slice(pathname.indexOf(base) + base.length);
          const url = pageUrl(path.slice(path.indexOf("/", 1)));
          const match = matchPageRoute(await this.getPageRoutes(), url, hasMirror);
          const text = await match?.route.markdown?.(url, match.params);
          return text === undefined ? new Response(null, { status: 404 }) : markdownResponse(text);
        },
      });
    },
    async middleware(request, next) {
      const path = stripBase(new URL(request.url).pathname, this.withBase("/"));
      if (path === undefined) return next();
      if (path === mirrorPath || path.startsWith(`${mirrorPath}/`))
        return rewrites.has(path) ? next() : new Response(null, { status: 404 });
      if (request.method !== "GET") return next();

      if (path.endsWith(".md")) {
        // the Markdown of other pages is prerendered
        const page = (await this.getLoader()).getPageByUrl(pageUrl(path));
        if (page && this.getContentRender(page.type) === "dynamic") return markdown(this, page);

        const response = await next();
        if (routes !== "all" || response.headers.get("Content-Type")?.startsWith("text/markdown"))
          return response;
        // a page rendered on demand: its route mirroring the page renders the Markdown
        const match = matchPageRoute(await this.getPageRoutes(), pageUrl(path), hasMirror);
        if (!match) return response;
        const mirror = joinPaths(
          mirrorBase(match.route.lang ?? this.i18nConfig?.defaultLanguage),
          crypto.randomUUID(),
          path,
        );
        rewrites.add(mirror);
        try {
          const mirrored = await next(mirror);
          return mirrored.ok ? mirrored : response;
        } finally {
          rewrites.delete(mirror);
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
