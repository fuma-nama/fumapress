import type { ApiRoute } from "fumadocs-core/framework/plugin";
import { isMarkdownPreferred } from "fumadocs-core/negotiation";
import { llms } from "fumadocs-core/source/llms";
import { fallbackOrigin, type Context } from "../context";
import type { AppShape, Awaitable, Plugin } from "../plugin";
import { stripBase } from "../routes";

export interface LLMsOptions<C extends AppShape = AppShape, Ctx extends Context<C> = Context<C>> {
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
  getLLMText?: (this: Ctx, page: C["page"]) => Awaitable<string | undefined>;
}

/** the path of the Markdown of a page: `<page>.md`, `/index.md` for the root */
export function markdownPath(url: string): string {
  return url === "/" ? "/index.md" : `${url}.md`;
}

export function markdownResponse(text: string): Response {
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
export function llmsPlugin<C extends AppShape = AppShape, Ctx extends Context<C> = Context<C>>(
  options: LLMsOptions<NoInfer<C>, NoInfer<Ctx>> = {},
): Plugin<C, Ctx> {
  const {
    autoRedirect = true,
    getLLMText = async function (page) {
      const text = await this.getPageText(page);
      if (text !== undefined) return `# ${page.data.title} (${page.url})\n\n${text}`;
    },
  } = options;

  async function markdown(ctx: Ctx, page: C["page"]): Promise<Response> {
    return markdownResponse((await getLLMText.call(ctx, page)) ?? "");
  }

  return {
    name: "core:llms.txt",
    // after the plugins setting their own `markdownUrl`, and after the middleware of others
    enforce: "post",
    transformPage(data) {
      return { ...data, markdownUrl: data.markdownUrl ?? this.withBase(markdownPath(data.url)) };
    },
    async routes() {
      const routes: ApiRoute[] = [
        {
          path: "/llms.txt",
          GET: async () => new Response(llms(await this.getLoader()).index()),
        },
        {
          path: "/llms-full.txt",
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
        },
      ];
      // the middleware serves them, from the pages of revalidated sources
      if (this.mode === "dynamic") return routes;

      // a route per file, a catch-all route would take the paths of pages
      for (const page of (await this.getLoader()).getPages()) {
        routes.push({ path: markdownPath(page.url), GET: () => markdown(this, page) });
      }
      return routes;
    },
    async middleware(request, next) {
      if (this.mode === "static" || request.method !== "GET") return next();
      const path = stripBase(new URL(request.url).pathname, this.withBase("/"));
      if (path === undefined) return next();

      if (path.endsWith(".md")) {
        // the other modes pre-render them
        if (this.mode !== "dynamic") return next();
        const page = (await this.getLoader()).getPageByUrl(
          path === "/index.md" ? "/" : path.slice(0, -3),
        );
        return page ? markdown(this, page) : next();
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
