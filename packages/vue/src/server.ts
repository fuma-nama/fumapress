import { getContext, type Context } from "./core/context";
import { escapeHtml, keyOf, mergeHead, renderHead, withBase } from "./core/head";
import type { ApiHandler, ApiRoute, BuildOutput, HttpMethod } from "./core/plugin";
import type { Press } from "./core/press";
import {
  PRERENDER_ROUTE,
  decodePath,
  encodePath,
  hasParams,
  matchRoute,
  pageDataPath,
  prerenderListPath,
  staticPathsOf,
} from "./core/routes";
import type { ClientAssets, HeadTag, Load, PageContent, PageData } from "./core/types";

export type { ClientAssets } from "./core/types";

export interface RenderEnv {
  ctx: Context;
  /** the URL in the address bar, where the app starts: with the base path and the query */
  url: string;
  /** its path in the site: decoded, without the base path */
  pathname: string;
  /** the language of the page: the app loads the data of the site in it */
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
  /** the data of a page outside the content, like its title: what the head tags are made from */
  data?: PageData;
}

export interface HandlerOptions {
  press: Press;
  /** the base path of the site @defaultValue "/" */
  base?: string;
  assets: ClientAssets;
  /** tags of every page from the theme, like the script that applies the color theme before the first paint */
  head?: HeadTag[];
  /** the paths of the custom pages of the app: the ones without params are generated at build time */
  customPages?: string[];
  /**
   * Whether this server is the prerenderer of a build. Only then does it list the paths to generate, run the `build`
   * hooks of plugins and serve the not found page as a file. It is a fact of the build, never read from a request.
   */
  prerender?: boolean;
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

const notFound = () => new Response("Not Found", { status: 404 });

/** the path of a request in the site: decoded and without the base path, none outside of it */
function sitePath(pathname: string, base: string): string | undefined {
  const prefix = base.slice(0, -1);
  if (pathname === prefix) return "/";
  if (pathname.startsWith(base)) return decodePath(pathname.slice(prefix.length));
}

/** the handler of a route for a method: its own, then `ALL`, then the JSON of its data */
function handlerOf(route: ApiRoute, method: string): ApiHandler | undefined {
  const own =
    route[method as HttpMethod] ?? (method === "HEAD" ? route.GET : undefined) ?? route.ALL;
  if (own || !route.data || (method !== "GET" && method !== "HEAD")) return own;

  const { data } = route;
  return async (_request, env) => {
    const value = await data(env);
    return value === undefined ? notFound() : Response.json(value);
  };
}

/** the route answering a method at a path: the first one matching the path that handles the method */
function findRoute(routes: readonly ApiRoute[], path: string, method: string) {
  let matched = false;
  for (const route of routes) {
    const params = matchRoute(route.path, path);
    if (!params) continue;
    matched = true;
    const handler = handlerOf(route, method);
    if (handler) return { route, params, handler, matched };
  }
  return { matched };
}

interface Target {
  /** the path of the page to render, without the base path */
  pathname: string;
  /** the path of the URL in the address bar: another one when a middleware serves `pathname` in its place */
  shown: string;
  search: string;
}

async function renderDocument(
  options: HandlerOptions,
  ctx: Context,
  { pathname, shown, search }: Target,
): Promise<Response> {
  const loaded = new Map<string, Promise<{ value: unknown; shared: boolean }>>();
  const load = (path: string) => {
    let entry = loaded.get(path);
    if (!entry) {
      // the app is at the URL of the address bar: its content is the one of the page served there
      const actual = path === pageDataPath(shown) ? pageDataPath(pathname) : path;
      entry = (async () => {
        // the route a request for the path reaches: only a data route has a value without a request
        const { route, params } = findRoute(ctx.routes, actual, "GET");
        return {
          value: route?.data ? await route.data({ params }) : undefined,
          shared: route?.shared === true,
        };
      })();
      loaded.set(path, entry);
    }
    return entry.then(({ value }) => value);
  };

  const lang = ctx.getLanguage(pathname);
  // the path is encoded here, where it goes out to the app as a URL
  const url = ctx.base + encodePath(shown).slice(1) + search;
  const output = await options.render({ ctx, url, pathname: shown, lang, load: load as Load });
  const { html, status = 200, assets = options.assets, data: ownData } = output;

  // A URL that names its language another way goes to the one a page has: without a prefix, like `/`, to the
  // default language when no language is hidden, and with the prefix of the hidden language to the URL without it.
  if (status === 404 && ctx.i18n) {
    const [, first = "", ...rest] = pathname.split("/");
    const target = ctx.i18n.languages.includes(first)
      ? ctx.localizePath(first, `/${rest.join("/")}`)
      : ctx.localizePath(ctx.defaultLanguage, pathname);
    if (target !== pathname && (await ctx.getContent(target))) {
      const location = ctx.base + encodePath(target).slice(1) + search;
      // a static host can't redirect: the generated page sends the browser on
      if (options.prerender) {
        const href = escapeHtml(location);
        return new Response(
          `<!DOCTYPE html><html lang="${escapeHtml(ctx.defaultLanguage)}"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=${href}"><link rel="canonical" href="${escapeHtml(ctx.absoluteUrl(target))}"><title>${href}</title></head><body><a href="${href}">${href}</a></body></html>`,
          { headers: { "Content-Type": "text/html; charset=utf-8" } },
        );
      }
      return new Response(null, { status: 302, headers: { Location: location } });
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
  const content = payload[pageDataPath(shown)] as PageContent | undefined;
  const head = await ctx.getHead({
    pathname,
    lang,
    page: ctx.getPage(pathname),
    data: content?.data ?? ownData,
  });
  // the module of the page is fetched with the app, not after it runs
  const modules =
    content && "module" in content.body ? [...assets.js, { href: content.body.module }] : assets.js;

  const tags = mergeHead(
    [
      { tag: "meta", attrs: { charset: "utf-8" } },
      { tag: "meta", attrs: { name: "viewport", content: "width=device-width, initial-scale=1" } },
    ],
    withBase(options.head, ctx.base),
    // a URL without a page has no address to prefer
    status === 404 ? head.filter((tag) => keyOf(tag) !== "link:canonical") : head,
    assets.css.map((css) => ({ tag: "link", attrs: { rel: "stylesheet", ...css } })),
    modules.map(({ href }) => ({ tag: "link", attrs: { rel: "modulepreload", href } })),
    shared.map((path) => ({
      tag: "link",
      attrs: { rel: "preload", href: ctx.withBase(path), as: "fetch", crossorigin: "anonymous" },
    })),
  );
  const data = JSON.stringify(payload).replace(/</g, "\\u003c");
  const script = assets.entry
    ? `<script type="module" src="${escapeHtml(assets.entry)}"></script>`
    : "";
  const document = `<!DOCTYPE html><html lang="${escapeHtml(lang)}"><head>${renderHead(tags)}</head><body><div id="app">${html}</div><script type="application/json" id="__PRESS__">${data}</script>${script}</body></html>`;

  return new Response(document, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

/**
 * The routes of the prerenderer of a build: the list of the paths to generate, which Nitro reads from a response
 * header, the not found page as a file, and the files the `build` hooks of plugins emit.
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
    const own = ctx.customPages;
    // without a hidden language, `/` leads to the default one
    const root = ctx.i18n && ctx.i18n.hideLocale !== "default-locale" && !own.includes("/");
    return [...(await ctx.getStaticPages()), ...ofRoutes.flat(), ...own, ...(root ? ["/"] : [])];
  }

  async function list(): Promise<string[][]> {
    const paths = await staticPaths();
    const emitted: string[] = [];
    const output: BuildOutput = {
      paths,
      fetch,
      emitFile(file, content) {
        const type = contentTypes[file.split(".").pop() ?? ""] ?? "application/octet-stream";
        const path = `/${file.replace(/^\/+/, "")}`;
        emitted.push(path);
        routes.push({
          path,
          render: "static",
          GET: () => new Response(content as BodyInit, { headers: { "Content-Type": type } }),
        });
      },
    };
    for (const plugin of ctx.plugins) await plugin.build?.call(ctx, output);
    // the emitted files are generated too. Paths are encoded here, once, for the URLs Nitro requests
    const urls = [...paths, ...emitted].map((path) => ctx.base + encodePath(path).slice(1));

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

  routes.push(
    {
      path: PRERENDER_ROUTE,
      async GET(_request, { params }) {
        const all = await (parts ??= list());
        const index = Number.parseInt(params.part ?? "", 10);
        const part = all[index];
        if (!part) return notFound();

        const next = index + 1 < all.length ? [ctx.withBase(prerenderListPath(index + 1))] : [];
        return new Response(`${part.join("\n")}\n`, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "x-nitro-prerender": [...part, ...next].join(", "),
          },
        });
      },
    },
    {
      // what a static host serves for a URL without a file: the not found page of the site, written like a page
      path: NOT_FOUND_PATH,
      render: "static",
      async GET() {
        const target = { pathname: NOT_FOUND_PATH, shown: NOT_FOUND_PATH, search: "" };
        const response = await renderDocument(options, ctx, target);
        return new Response(response.body, { headers: response.headers });
      },
    },
  );
  return routes;
}

async function handle(
  options: HandlerOptions,
  ctx: Context,
  routes: readonly ApiRoute[],
  request: Request,
  shown: string,
): Promise<Response> {
  const url = new URL(request.url);
  const pathname = sitePath(url.pathname, ctx.base);
  if (pathname === undefined) return notFound();

  const found = findRoute(routes, pathname, request.method);
  if (found.handler) return found.handler(request, { params: found.params });

  if (request.method !== "GET" && request.method !== "HEAD") {
    return found.matched ? new Response("Method Not Allowed", { status: 405 }) : notFound();
  }
  const response = await renderDocument(options, ctx, { pathname, shown, search: url.search });
  // a route is at the path, for other methods only, and no page is
  return response.status === 404 && found.matched
    ? new Response("Method Not Allowed", { status: 405 })
    : response;
}

/** the server of a site: the middleware of its plugins, then their routes, then its pages */
export function createFetchHandler(
  options: HandlerOptions,
): (request: Request) => Promise<Response> {
  let ofBuild: ApiRoute[] | undefined;

  const fetch = async (request: Request): Promise<Response> => {
    const ctx = await getContext(options.press, {
      base: options.base,
      customPages: options.customPages?.filter((path) => !hasParams(path)),
    });
    if (options.prerender) ofBuild ??= buildRoutes(options, ctx, fetch);
    // read on each request: a build adds the files it emits
    const routes = [...(ofBuild ?? []), ...ctx.routes];
    const middlewares = ctx.plugins.filter((plugin) => plugin.middleware);

    const url = new URL(request.url);
    const shown = sitePath(url.pathname, ctx.base);
    if (shown === undefined) return notFound();
    // middleware and routes see a path in one form, whatever the request spells it like
    const canonical = ctx.base + encodePath(shown).slice(1);
    if (canonical !== url.pathname) {
      url.pathname = canonical;
      request = new Request(url, request);
    }

    const run = (index: number, current: Request): Promise<Response> => {
      const plugin = middlewares[index];
      if (!plugin) return handle(options, ctx, routes, current, shown);
      return plugin.middleware!.call(ctx, current, (rewrite) => {
        if (rewrite === undefined) return run(index + 1, current);

        // another path of the site, with an optional query
        const at = rewrite.indexOf("?");
        const path = at < 0 ? rewrite : rewrite.slice(0, at);
        const query = at < 0 ? undefined : rewrite.slice(at + 1);
        const decoded = decodePath(path);
        if (decoded === undefined) {
          throw new Error(`[Fumapress] \`next("${rewrite}")\` is not a path of the site.`);
        }
        const target = new URL(current.url);
        target.pathname = ctx.base + encodePath(decoded).slice(1);
        if (query !== undefined) target.search = query;
        return run(index + 1, new Request(target, current));
      });
    };

    return run(0, request);
  };

  return fetch;
}
