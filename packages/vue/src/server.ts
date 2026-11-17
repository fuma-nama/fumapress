import { getContext, type Context } from "./core/context";
import { escapeHtml, mergeHead, renderHead } from "./core/head";
import { localeOf } from "./core/i18n";
import type { ApiHandler, ApiRoute, BuildOutput, HttpMethod } from "./core/plugin";
import type { Press } from "./core/press";
import {
  PRERENDER_ROUTE,
  matchRoute,
  normalizePath,
  pageDataPath,
  prerenderListPath,
  staticPathsOf,
} from "./core/routes";
import type { HeadTag, Load, PageContent } from "./core/types";

export interface ClientAssets {
  entry: string;
  css: { href: string }[];
  js: { href: string }[];
}

export interface RenderEnv {
  ctx: Context;
  /** the URL of the page, without the base path */
  pathname: string;
  search: string;
  /** the language of the URL: the app loads the data of the site in it */
  lang: string;
  /** the data routes of the site, called without a request: what the app loads comes with the page */
  load: Load;
}

export interface RenderOutput {
  html: string;
  /** @defaultValue 200 */
  status?: number;
  /** the assets of the page, with those of its route @defaultValue the client entry's */
  assets?: ClientAssets;
}

export interface HandlerOptions {
  press: Press;
  /** the base path of the site @defaultValue "/" */
  base?: string;
  assets: ClientAssets;
  /** tags of every page from the theme, like the script that applies the color theme before the first paint */
  head?: HeadTag[];
  /** paths of pages outside the content to generate at build time, like custom pages without params */
  staticPaths?: string[];
  /** render the app at a URL to HTML */
  render: (env: RenderEnv) => Promise<RenderOutput>;
}

/** the size of a response header is limited: a part of the list stays well under it */
const LIST_PART_SIZE = 4000;

/** the file static hosts serve for a URL without one */
const NOT_FOUND_PATH = "/404.html";

const contentTypes: Record<string, string> = {
  html: "text/html; charset=utf-8",
  json: "application/json",
  md: "text/markdown; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  xml: "application/xml; charset=utf-8",
};

function stripBase(pathname: string, base: string): string | undefined {
  if (base === "/") return pathname;
  const prefix = base.slice(0, -1);
  if (pathname === prefix) return "/";
  if (pathname.startsWith(base)) return pathname.slice(prefix.length);
}

/** the handler of a route for a method: its own, then `ALL`, then the JSON of its data */
function handlerOf(route: ApiRoute, method: string): ApiHandler | undefined {
  const own =
    route[method as HttpMethod] ?? (method === "HEAD" ? route.GET : undefined) ?? route.ALL;
  if (own || !route.data || (method !== "GET" && method !== "HEAD")) return own;

  const { data } = route;
  return async (_request, env) => {
    const value = await data(env);
    return value === undefined ? new Response("Not Found", { status: 404 }) : Response.json(value);
  };
}

async function renderDocument(
  options: HandlerOptions,
  ctx: Context,
  pathname: string,
  search: string,
): Promise<Response> {
  const loaded = new Map<string, Promise<{ value: unknown; shared: boolean }>>();
  const load = (path: string) => {
    let entry = loaded.get(path);
    if (!entry) {
      entry = (async () => {
        // the route a request for the path reaches: the first one matching it
        for (const route of ctx.routes) {
          const params = matchRoute(route.path, path);
          if (!params) continue;
          return { value: await route.data?.({ params }), shared: route.shared === true };
        }
        return { value: undefined, shared: false };
      })();
      loaded.set(path, entry);
    }
    return entry.then(({ value }) => value);
  };

  const lang = ctx.getLanguage(pathname);
  const output = await options.render({ ctx, pathname, search, lang, load: load as Load });
  const { html, status = 200, assets = options.assets } = output;

  // a URL without the prefix of its language, like `/` when no language is hidden, goes to the default language
  if (status === 404 && ctx.i18n && localeOf(ctx.i18n, pathname).lang === undefined) {
    const target = ctx.localizePath(ctx.defaultLanguage, pathname);
    if (await ctx.getContent(target)) {
      return new Response(null, {
        status: 302,
        headers: { Location: encodeURI(ctx.withBase(target)) + search },
      });
    }
  }

  // what the app loaded comes with the page; a shared value is the same on every page, so the browser fetches it
  // once: the page preloads it, and `crossorigin` lets the request of the app reuse that one
  const payload: Record<string, unknown> = {};
  const shared: string[] = [];
  for (const [path, entry] of loaded) {
    const { value, shared: isShared } = await entry;
    if (value === undefined) continue;
    if (isShared) shared.push(path);
    else payload[path] = value;
  }

  // the content the app loaded for the URL: none on a custom page
  const content = payload[pageDataPath(pathname)] as PageContent | undefined;
  const head = await ctx.getHead({
    pathname,
    lang,
    page: ctx.getPage(pathname),
    data: content?.data,
  });
  // the module of the page is fetched with the app, not after it runs
  const modules =
    content && "module" in content.body ? [...assets.js, { href: content.body.module }] : assets.js;

  const tags = mergeHead(
    [
      { tag: "meta", attrs: { charset: "utf-8" } },
      { tag: "meta", attrs: { name: "viewport", content: "width=device-width, initial-scale=1" } },
    ],
    options.head,
    head,
    assets.css.map(({ href }) => ({ tag: "link", attrs: { rel: "stylesheet", href } })),
    modules.map(({ href }) => ({ tag: "link", attrs: { rel: "modulepreload", href } })),
    shared.map((path) => ({
      tag: "link",
      attrs: { rel: "preload", href: ctx.withBase(path), as: "fetch", crossorigin: "anonymous" },
    })),
  );
  const data = JSON.stringify(payload).replace(/</g, "\\u003c");
  const document = `<!DOCTYPE html><html lang="${escapeHtml(lang)}"><head>${renderHead(tags)}</head><body><div id="app">${html}</div><script type="application/json" id="__PRESS__">${data}</script><script type="module" src="${assets.entry}"></script></body></html>`;

  return new Response(document, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

/**
 * The routes of a build. The first lists the paths to generate, for the prerenderer of Nitro only: it marks its
 * requests with a header, so a running server has no list and never runs `build` hooks. The others are the files
 * those hooks emit.
 */
function buildRoutes(
  options: HandlerOptions,
  ctx: Context,
  fetch: (request: Request) => Promise<Response>,
): ApiRoute[] {
  const routes: ApiRoute[] = [];
  let parts: Promise<string[][]> | undefined;

  /** the pages of static sources, the static routes and the pages of the app known ahead */
  async function staticPaths(): Promise<string[]> {
    const ofRoutes = await Promise.all(
      [...ctx.routes, ...routes]
        .filter((route) => route.render === "static" && (route.GET ?? route.ALL ?? route.data))
        .map(staticPathsOf),
    );
    const own = options.staticPaths ?? [];
    // without a hidden language, `/` leads to the default one
    const root = ctx.i18n && ctx.i18n.hideLocale !== "default-locale" && !own.includes("/");
    return [...(await ctx.getStaticPages()), ...ofRoutes.flat(), ...own, ...(root ? ["/"] : [])];
  }

  async function list(): Promise<string[][]> {
    const output: BuildOutput = {
      paths: await staticPaths(),
      fetch,
      emitFile(path, content) {
        const type = contentTypes[path.split(".").pop() ?? ""] ?? "application/octet-stream";
        routes.push({
          path: `/${path.replace(/^\/+/, "")}`,
          render: "static",
          GET: () => new Response(content as BodyInit, { headers: { "Content-Type": type } }),
        });
      },
    };
    for (const plugin of ctx.plugins) await plugin.build?.call(ctx, output);
    // again: the emitted files are static routes
    const urls = (await staticPaths()).map((path) => encodeURI(ctx.withBase(path)));

    const out: string[][] = [[]];
    let size = 0;
    for (const url of urls) {
      if (size + url.length > LIST_PART_SIZE) {
        out.push([]);
        size = 0;
      }
      out.at(-1)!.push(url);
      size += url.length + 2;
    }
    return out;
  }

  const listRoute: ApiRoute = {
    path: PRERENDER_ROUTE,
    async GET(request, { params }) {
      if (!request.headers.has("x-nitro-prerender")) {
        return new Response("Not Found", { status: 404 });
      }
      const all = await (parts ??= list());
      const index = Number.parseInt(params.part ?? "", 10);
      const part = all[index];
      if (!part) return new Response("Not Found", { status: 404 });

      const next = index + 1 < all.length ? [ctx.withBase(prerenderListPath(index + 1))] : [];
      return new Response(`${part.join("\n")}\n`, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "x-nitro-prerender": [...part, ...next].join(", "),
        },
      });
    },
  };

  // what a static host serves for a URL without a file: the not found page of the site, generated like a page.
  // On a running server the path has no page, like any other without one.
  const notFoundRoute: ApiRoute = {
    path: NOT_FOUND_PATH,
    render: "static",
    async GET(request) {
      const response = await renderDocument(options, ctx, NOT_FOUND_PATH, "");
      return request.headers.has("x-nitro-prerender")
        ? new Response(response.body, { headers: response.headers })
        : response;
    },
  };

  routes.push(listRoute, notFoundRoute);
  return routes;
}

async function handle(
  options: HandlerOptions,
  ctx: Context,
  routes: readonly ApiRoute[],
  request: Request,
): Promise<Response> {
  const url = new URL(request.url);
  const stripped = stripBase(url.pathname, ctx.base);
  if (stripped === undefined) return new Response("Not Found", { status: 404 });
  const pathname = normalizePath(stripped);

  for (const route of routes) {
    const params = matchRoute(route.path, pathname);
    if (!params) continue;
    const handler = handlerOf(route, request.method);
    if (!handler) return new Response("Method Not Allowed", { status: 405 });
    return handler(request, { params });
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  return renderDocument(options, ctx, pathname, url.search);
}

/** the server of a site: the middleware of its plugins, then their routes, then its pages */
export function createFetchHandler(
  options: HandlerOptions,
): (request: Request) => Promise<Response> {
  let ofBuild: ApiRoute[] | undefined;

  const fetch = async (request: Request): Promise<Response> => {
    const ctx = await getContext(options.press, { base: options.base });
    ofBuild ??= buildRoutes(options, ctx, fetch);
    // read on each request: a build adds the files it emits
    const routes = [...ofBuild, ...ctx.routes];
    const middlewares = ctx.plugins.filter((plugin) => plugin.middleware);

    const run = (index: number, current: Request): Promise<Response> => {
      const plugin = middlewares[index];
      if (!plugin) return handle(options, ctx, routes, current);
      return plugin.middleware!.call(ctx, current, (rewrite) => {
        if (rewrite === undefined) return run(index + 1, current);
        const target = new URL(current.url);
        target.pathname = ctx.withBase(rewrite);
        return run(index + 1, new Request(target, current));
      });
    };

    return run(0, request);
  };

  return fetch;
}
