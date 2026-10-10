import { llms } from "fumadocs-core/source/llms";
import type { Awaitable } from "@/lib/types";
import type { PressPlugin } from "@/app/plugin";
import { appContext, type AppContext, type AppShape } from "@/app/context";
import { unstable_notFound } from "waku/router/server";
import type { MiddlewareHandler } from "hono";
import { isMarkdownPreferred } from "fumadocs-core/negotiation";
import { joinPaths } from "@/lib/pathname";
import { inheritedFrom } from "@/lib/i18n";
import { DocsLayoutContextData } from "@/layouts/docs";
import { renderRoute } from "fumadocs-core/server";
import { createElement, type FC } from "react";
import type { RouteParams } from "@/lib/routes";
import type { PressRoute, RouteProps } from "@/lib/types";

export interface LLMsOptions<C extends AppShape = AppShape> {
  /**
   * When request prefers Markdown response, automatically redirect to the generated Markdown route.
   * Ignored when static mode is enabled.
   *
   * @default true
   */
  autoRedirect?: boolean;

  getLLMText?: (this: AppContext<C>, page: C["page"]) => Awaitable<string | undefined>;

  /**
   * Which routes get a Markdown version (`/page.md`, `/index.md` for the root):
   *
   * - `"content"`: pages of your content source.
   * - `"all"`: also every page created with `createPage()` (e.g. `src/pages/index.tsx`, blog pages) whose component
   *   calls `asMarkdown()` from `fumapress/markdown`. Static pages are pre-rendered, dynamic pages are rendered on
   *   request. Pages without a Markdown form respond 404.
   *
   * @default "content"
   */
  routes?: "content" | "all";
}

export function llmsPlugin<C extends AppShape = AppShape>(
  options: LLMsOptions<NoInfer<C>> = {},
): PressPlugin<C> {
  const {
    autoRedirect = true,
    routes = "content",
    getLLMText: _getLLMText = async function getLLMTextDefault(page) {
      for (const adapter of this.adapters) {
        const txt = await adapter["core:get-text"]?.call(this, page);

        if (txt !== undefined) {
          return `# ${page.data.title} (${page.url})\n\n${txt}`;
        }
      }
    },
  } = options;

  function markdownResponse(txt: string) {
    return new Response(txt, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
      },
    });
  }

  function withMd(pathname: string) {
    return pathname === "/" ? "/index.md" : pathname + ".md";
  }

  function initTransformers(data: DocsLayoutContextData<C>) {
    data.transformers ??= [];
    data.transformers.push(({ data, page }) => {
      data.markdownUrl ??= withMd(page.url);
      return data;
    });
  }

  /** Markdown of a page of `createPage()`, `undefined` when its component doesn't call `asMarkdown()` */
  function renderMarkdown(route: PressRoute, path: string, params: RouteParams) {
    const Page = route.component as FC<RouteProps>;
    return renderRoute(createElement(Page, { ...params, path, lang: route.lang }));
  }

  /** `.md` paths of the static site, content pages first */
  const mdPaths = new Set<string>();
  return {
    name: "core:llms.txt",
    enforce: "post",
    init() {
      initTransformers((this.data["core:docs-layout"] ??= {}));
      initTransformers((this.data["core:notebook-layout"] ??= {}) as DocsLayoutContextData<C>);
      initTransformers((this.data["core:glass-layout"] ??= {}) as DocsLayoutContextData<C>);
      initTransformers((this.data["core:spacious-layout"] ??= {}) as DocsLayoutContextData<C>);
    },
    createMiddlewares({ app }) {
      if (this.mode === "static") return;
      const middlewares: MiddlewareHandler[] = [];

      if (autoRedirect) {
        middlewares.push(async (c, next) => {
          const { req } = c;
          if (req.method !== "GET" || req.path.endsWith(".md")) return next();

          if (isMarkdownPreferred(req.raw)) {
            const url = new URL(withMd(req.path), req.url);
            const res = await app.fetch(new Request(url));

            if (res.ok) {
              res.headers.append("Vary", "Accept");
              return res;
            }
          }

          // the HTML form is negotiable too, caches must key on `Accept` for both forms
          await next();
          if (c.res.headers.get("Content-Type")?.startsWith("text/html")) {
            c.res.headers.append("Vary", "Accept");
          }
        });
      }

      // serves "/page.md" from "/_llms.txt/page", "/index.md" from "/_llms.txt";
      // pre-rendered `.md` routes are tried first — only a Markdown response wins,
      // a dynamic page matching the literal path (e.g. a catch-all) serves HTML
      middlewares.push(async (c, next) => {
        const { req } = c;
        if (req.method !== "GET" || !req.path.endsWith(".md")) return next();

        await next();
        if (c.res.ok && c.res.headers.get("Content-Type")?.startsWith("text/markdown")) return;

        const url = new URL(
          joinPaths("/_llms.txt", req.path === "/index.md" ? "" : req.path.replace(/\.md$/, "")),
          req.url,
        );
        const res = await app.fetch(new Request(url));
        if (!res.ok) return;

        // clear first, assigning over an existing response merges its headers in Hono
        c.res = undefined;
        c.res = res;
      });

      return middlewares;
    },
    async createPages(fns) {
      const getLLMText = _getLLMText.bind(this);
      // looks up every language
      const getPageByUrl = async (url: string) => (await this.getLoader()).getPageByUrl(url);

      fns.createApiIsomorphic({
        path: "/llms.txt",
        handler: async () => {
          const source = await this.getLoader();
          return new Response(await llms(source).index());
        },
      });

      fns.createApiIsomorphic({
        path: "/llms-full.txt",
        handler: async () => {
          const pending: Awaitable<string | undefined>[] = [];
          const source = await this.getLoader();
          for (const page of source.getPages()) {
            if (!inheritedFrom(source, this.i18nConfig, page)) pending.push(getLLMText(page));
          }
          const scanned = await Promise.all(pending);

          return new Response(scanned.filter((item) => item !== undefined).join("\n\n"));
        },
      });

      if (this.mode === "dynamic") {
        const handler = async (_req: Request, { params }: { params: RouteParams }) => {
          const slugs = (params.slugs as string[] | undefined) ?? [];
          const page = await getPageByUrl("/" + slugs.join("/"));
          if (!page) unstable_notFound();

          return markdownResponse((await getLLMText(page)) ?? "");
        };

        // Waku.js `[...slugs]` never matches zero segments under a non-root base
        fns.createApiIsomorphic({ render: "dynamic", path: "/_llms.txt", handler });
        fns.createApiIsomorphic({ render: "dynamic", path: "/_llms.txt/[...slugs]", handler });
      }

      if (this.mode === "static" || this.mode === "default") {
        const staticPaths: string[][] = [];
        for (const page of (await this.getLoader()).getPages()) {
          const path = withMd(page.url);
          staticPaths.push(path.slice(1).split("/"));
          mdPaths.add(path);
        }

        fns.createApiIsomorphic({
          render: "static",
          path: "/[...slugs]",
          staticPaths,
          handler: async (_req, { params }) => {
            const path = "/" + (params.slugs as string[]).join("/");
            const page = await getPageByUrl(path === "/index.md" ? "/" : path.replace(/\.md$/, ""));
            if (!page) unstable_notFound();

            return markdownResponse((await getLLMText(page)) ?? "");
          },
        });
      }
    },
    async configureRoutes({ createApi, createApiIsomorphic, getRoutes }) {
      if (routes !== "all") return;

      // static pages hold their Markdown pre-rendered: a static route that 404s would fail the build,
      // so only pages with a Markdown form get one. Content pages take precedence when a page maps
      // to the same `.md` path.
      for (const route of getRoutes()) {
        // dynamic pages render on request, from a route mirroring theirs so Waku.js matches it
        if (route.render === "dynamic") {
          if (route.exactPath) continue;
          createApiIsomorphic({
            render: "dynamic",
            path: joinPaths("/_llms.txt", route.path),
            handler: async (req, { params }) => {
              const { pathname } = new URL(req.url);
              const text = await renderMarkdown(
                route,
                pathname.slice(pathname.indexOf("/_llms.txt") + "/_llms.txt".length) || "/",
                params,
              );
              if (text === undefined) unstable_notFound();

              return markdownResponse(text);
            },
          });
          continue;
        }

        for (const page of route.pages) {
          const path = withMd(page.path);
          if (mdPaths.has(path)) continue;

          const text = await appContext.run(this, () =>
            renderMarkdown(route, page.path, page.params),
          );
          if (text === undefined) continue;

          mdPaths.add(path);
          createApi({
            render: "static",
            path,
            method: "GET",
            unstable_sourceFile: route.unstable_sourceFile,
            handler: async () => markdownResponse(text),
          });
        }
      }
    },
  };
}
