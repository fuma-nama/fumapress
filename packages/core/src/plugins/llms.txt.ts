import { llms } from "fumadocs-core/source/llms";
import type { Awaitable } from "@/lib/types";
import type { PressPlugin } from "@/app/plugin";
import { appContext, withoutFallbackPages, type AppContext, type AppShape } from "@/app/context";
import { CreatePage, unstable_notFound } from "waku/router/server";
import type { MiddlewareHandler } from "hono";
import { isMarkdownPreferred } from "fumadocs-core/negotiation";
import { joinPathname } from "@/lib/pathname";
import { DocsLayoutContextData } from "@/layouts/docs";
import { renderRoute } from "fumadocs-core/server";
import { createElement, type FC } from "react";

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

  let includedPages: CreatedPage[] = [];
  let mocked_createPage: CreatePage | undefined;
  return {
    name: "core:llms.txt",
    enforce: "post",
    init() {
      initTransformers((this.data["core:docs-layout"] ??= {}));
      initTransformers((this.data["core:notebook-layout"] ??= {}) as DocsLayoutContextData<C>);
      initTransformers((this.data["core:glass-layout"] ??= {}) as DocsLayoutContextData<C>);
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
          joinPathname("_llms.txt", req.path === "/index.md" ? "" : req.path.replace(/\.md$/, "")),
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
    prepareCreatePages(fns) {
      mocked_createPage = fns.createPage;
      includedPages = [];
      fns.createPage = (page) => {
        if (routes === "all" && page.component) {
          includedPages.push(page);
        }
        return mocked_createPage!(page);
      };
    },
    async createPages(fns) {
      fns.createPage = mocked_createPage!;
      const renderMode = this.mode === "default" ? "static" : this.mode;
      const getLLMText = _getLLMText.bind(this);
      const getPageByUrl = async (url: string) => {
        const source = await this.getLoader();
        for (const language of this.i18nConfig?.languages ?? [undefined]) {
          const page = source.getPageByHref(url, { language })?.page;
          if (page) return page;
        }
      };
      const renderPage = (page: CreatedPage, pathname: string, params: RouteParams) =>
        renderRoute(
          createElement(
            page.component as FC,
            {
              ...params,
              path: pathname,
            } as Record<string, unknown>,
          ),
        );

      fns.createApiIsomorphic({
        render: renderMode,
        path: "/llms.txt",
        handler: async () => {
          const source = await this.getLoader();
          return new Response(llms(source).index());
        },
      });

      fns.createApiIsomorphic({
        render: renderMode,
        path: "/llms-full.txt",
        handler: async () => {
          const source = withoutFallbackPages(await this.getLoader(), this.i18nConfig);
          const scanned = await Promise.all(source.getPages().map(getLLMText));

          return new Response(scanned.filter((item) => item !== undefined).join("\n\n"));
        },
      });

      // custom pages of `routes: "all"`, dynamic ones are matched per request
      const dynamicPages: (PrecompiledRoutePath & CreatedPage)[] = [];
      const staticPages: { pathname: string; params: RouteParams; page: CreatedPage }[] = [];

      if (routes === "all") {
        for (const page of includedPages) {
          if (page.exactPath) continue;

          if (page.render === "dynamic") {
            dynamicPages.push({ ...precompileRoutePath(page.path), ...page });
            continue;
          }

          const segments = page.path.split("/").filter(Boolean);
          // `staticPaths` is required (and validated by Waku.js) only for paths with dynamic segments
          const entries = segments.some((seg) => seg.startsWith("["))
            ? (page.staticPaths ?? [])
            : [[]];

          for (const entry of entries) {
            staticPages.push({
              ...expandStaticPath(segments, typeof entry === "string" ? [entry] : entry),
              page,
            });
          }
        }

        // match more specific routes first like Waku.js, a root path only matches "/" so it goes before catch-alls
        dynamicPages.sort((a, b) => {
          if (a.length === 0 || b.length === 0) return a.length - b.length;
          return b.length - a.length || a.priority - b.priority;
        });
      }

      if (this.mode === "dynamic" || this.mode === "default") {
        const handler = async (_req: Request, { params }: { params: RouteParams }) => {
          const slugs = (params.slugs as string[] | undefined) ?? [];
          const pathname = "/" + slugs.join("/");

          if (this.mode === "dynamic") {
            const page = await getPageByUrl(pathname);
            if (page) return markdownResponse((await getLLMText(page)) ?? "");
          }

          for (const page of dynamicPages) {
            const routeParams = matchRoutePath(page, pathname);
            if (!routeParams) continue;

            const res = await renderPage(page, pathname, routeParams);
            if (res) return markdownResponse(res);
            break;
          }

          unstable_notFound();
        };

        // Waku.js `[...slugs]` never matches zero segments under a non-root base
        fns.createApiIsomorphic({ render: "dynamic", path: "/_llms.txt", handler });
        fns.createApiIsomorphic({ render: "dynamic", path: "/_llms.txt/[...slugs]", handler });
      }

      const mdPaths = new Set<string>();
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

      // routes for static custom pages hold their Markdown pre-rendered: a static route that 404s
      // would fail the build, so only pages with a Markdown form get one. Content pages take
      // precedence when a custom page maps to the same `.md` path.
      for (const { pathname, params, page } of staticPages) {
        const path = withMd(pathname);
        if (mdPaths.has(path)) continue;

        const text = await appContext.run(this, () => renderPage(page, pathname, params));
        if (text === undefined) continue;

        mdPaths.add(path);
        fns.createApi({
          render: "static",
          path,
          method: "GET",
          unstable_sourceFile: page.unstable_sourceFile,
          handler: async () => markdownResponse(text),
        });
      }
    },
  };
}

type RouteParams = Record<string, string | string[]>;

interface CreatedPage {
  render: "static" | "dynamic";
  path: string;
  staticPaths?: readonly string[] | readonly string[][];
  component: FC<never>;
  exactPath?: boolean;
  unstable_sourceFile?: string;
}

enum ParameterType {
  Single,
  Nested,
}

interface PrecompiledRoutePath {
  regex: RegExp;
  params: Map<string, ParameterType>;
  /** non-group segments, longer = more specific */
  length: number;
  /** compares equal-length routes segment by segment, smaller = higher priority */
  priority: number;
}

function precompileRoutePath(routePath: string): PrecompiledRoutePath {
  const segments = routePath.split("/").filter(Boolean);
  const params = new Map<string, ParameterType>();
  let length = 0;
  let priority = 0;
  let pattern = "";

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!;
    if (seg.startsWith("(") && seg.endsWith(")")) continue;

    length++;
    priority *= 10;
    if (seg.startsWith("[...") && seg.endsWith("]")) {
      const name = seg.slice(4, -1);
      priority += 3;
      pattern += i === segments.length - 1 ? `(?:\\/(?<${name}>.*))?` : `\\/(?<${name}>.*)`;
      params.set(name, ParameterType.Nested);
    } else if (seg.startsWith("[") && seg.endsWith("]")) {
      const name = seg.slice(1, -1);
      priority += 2;
      pattern += `\\/(?<${name}>[^/]+)`;
      params.set(name, ParameterType.Single);
    } else {
      priority += 1;
      pattern += `\\/${RegExp.escape(seg)}`;
    }
  }

  return {
    regex: new RegExp(`^${pattern || "\\/"}$`),
    length,
    priority,
    params,
  };
}

function matchRoutePath(precompiled: PrecompiledRoutePath, pathname: string): RouteParams | null {
  const match = precompiled.regex.exec(pathname);
  if (match === null) return null;

  const params: RouteParams = {};
  for (const [k, type] of precompiled.params) {
    const v = match.groups![k] ?? "";

    if (type === ParameterType.Single) {
      params[k] = v;
    } else {
      params[k] = v.length === 0 ? [] : v.split("/");
    }
  }

  return params;
}

/**
 * The concrete pathname (without route groups) and route params of one entry in `staticPaths`,
 * where its values fill the dynamic segments of `routePath` in order.
 */
function expandStaticPath(
  segments: string[],
  values: readonly string[],
): { pathname: string; params: RouteParams } {
  const params: RouteParams = {};
  let pathname = "";
  let i = 0;

  for (const seg of segments) {
    if (seg.startsWith("(") && seg.endsWith(")")) continue;

    if (seg.startsWith("[...") && seg.endsWith("]")) {
      const rest = values.slice(i);
      i = values.length;
      params[seg.slice(4, -1)] = rest;
      for (const value of rest) pathname += "/" + value;
    } else if (seg.startsWith("[") && seg.endsWith("]")) {
      const value = values[i++]!;
      params[seg.slice(1, -1)] = value;
      pathname += "/" + value;
    } else {
      pathname += "/" + seg;
    }
  }

  return { pathname: pathname.length === 0 ? "/" : pathname, params };
}
