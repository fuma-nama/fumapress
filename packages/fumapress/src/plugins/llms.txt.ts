import { appContext, type AppShape } from "@/app/context";
import type { PressPlugin } from "@/app/plugin";
import { joinPaths } from "@/lib/pathname";
import type { PressRoute, RouteProps } from "@/lib/types";
import * as Press from "@fumapress/core/plugins/llms.txt";
import type { RouteParams } from "fumadocs-core/framework/plugin";
import { renderRoute } from "fumadocs-core/server";
import { createElement, type FC } from "react";
import { unstable_notFound } from "waku/router/server";

export interface LLMsOptions<C extends AppShape = AppShape> extends Press.LLMsOptions<C> {
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

/** the routes mirroring the dynamic pages of `createPage()`, they render their Markdown */
const mirrorPath = "/_llms.txt";

function markdownPath(url: string): string {
  return url === "/" ? "/index.md" : `${url}.md`;
}

function markdownResponse(text: string): Response {
  return new Response(text, { headers: { "Content-Type": "text/markdown; charset=utf-8" } });
}

/** Markdown of a page of `createPage()`, `undefined` when its component doesn't call `asMarkdown()` */
function renderMarkdown(route: PressRoute, path: string, params: RouteParams) {
  const Page = route.component as FC<RouteProps>;
  return renderRoute(createElement(Page, { ...params, path, lang: route.lang }));
}

/**
 * `llms.txt`, `llms-full.txt` and the Markdown of pages: `/docs/page.md`, `/index.md` for the root page.
 *
 * Pages rendered on request serve their Markdown to requests preferring it (`Accept: text/markdown`).
 */
export function llmsPlugin<C extends AppShape = AppShape>({
  routes = "content",
  ...options
}: LLMsOptions<NoInfer<C>> = {}): PressPlugin<C> {
  const plugin = Press.llmsPlugin<C>(options);
  if (routes === "content") return plugin;

  /** `.md` paths of content pages and static pages of `createPage()` */
  const markdownPaths = new Set<string>();
  return {
    ...plugin,
    async configureRoutes({ createApi, createApiIsomorphic, getRoutes }) {
      // content pages take precedence when a page maps to the same `.md` path
      for (const page of (await this.getLoader()).getPages()) {
        markdownPaths.add(markdownPath(page.url));
      }

      // static pages hold their Markdown pre-rendered: a static route that 404s would fail the build,
      // so only pages with a Markdown form get one
      for (const route of getRoutes()) {
        // dynamic pages render on request, from a route mirroring theirs so Waku.js matches it
        if (route.render === "dynamic") {
          if (route.exactPath) continue;
          createApiIsomorphic({
            render: "dynamic",
            path: joinPaths(mirrorPath, route.path),
            handler: async (req, { params }) => {
              const { pathname } = new URL(req.url);
              const text = await renderMarkdown(
                route,
                pathname.slice(pathname.indexOf(mirrorPath) + mirrorPath.length) || "/",
                params,
              );
              if (text === undefined) unstable_notFound();

              return markdownResponse(text);
            },
          });
          continue;
        }

        for (const page of route.pages) {
          const path = markdownPath(page.path);
          if (markdownPaths.has(path)) continue;

          const text = await appContext.run(this, () =>
            renderMarkdown(route, page.path, page.params),
          );
          if (text === undefined) continue;

          markdownPaths.add(path);
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
    // pre-rendered `.md` routes are tried first: only a Markdown response wins, a dynamic page
    // matching the literal path (e.g. a catch-all) serves HTML
    middleware(request, next) {
      return plugin.middleware!.call(this, request, async (rewrite) => {
        const response = await next(rewrite);
        if (rewrite !== undefined || request.method !== "GET") return response;
        if (response.ok && response.headers.get("Content-Type")?.startsWith("text/markdown"))
          return response;

        const base = this.withBase("/");
        const { pathname } = new URL(request.url);
        const path = base === "/" ? pathname : pathname.slice(base.length);
        if (!path.endsWith(".md")) return response;

        const mirrored = await next(
          joinPaths(mirrorPath, path === "/index.md" ? "/" : path.slice(0, -3)),
        );
        return mirrored.ok ? mirrored : response;
      });
    },
  };
}
