import { expandRoute, matchRoute, rootRedirect, stripBase, type Context } from "@fumapress/core";
import {
  methods,
  type ApiRoute,
  type Method,
  type RouteHandler,
  type RouteParams,
} from "fumadocs-core/framework/plugin";
import type { Page } from "fumadocs-core/source";

const routes = new WeakMap<object, Promise<ApiRoute[]>>();
const staticPaths = new WeakMap<ApiRoute[], Set<string>>();

/** the routes of plugins, once per content: plugins create their servers in `routes()`, like the index of search */
export async function getApiRoutes(ctx: Context): Promise<ApiRoute[]> {
  const loader = await ctx.getLoader();
  let out = routes.get(loader);
  if (!out) routes.set(loader, (out = ctx.getApiRoutes()));
  return out;
}

/** whether a route of plugins serves `path` (without the base path), with or without the trailing slash */
export async function isApiRoute(ctx: Context, path: string): Promise<boolean> {
  const list = await getApiRoutes(ctx);
  let paths = staticPaths.get(list);
  if (!paths) {
    paths = new Set();
    for (const route of list) {
      if (route.render === "dynamic") continue;
      for (const page of expandRoute(route.path, route.staticPaths).pages) paths.add(page.pathname);
    }
    staticPaths.set(list, paths);
  }
  const trimmed = path.replace(/(.)\/$/, "$1");
  return paths.has(trimmed) || (await matchApiRoute(ctx, trimmed)) !== undefined;
}

/** the static paths of `[...fumapressPage]`, no pages in `dynamic` mode */
export async function pageStaticPaths(ctx: Context) {
  const paths: {
    params: { fumapressPage?: string };
    props: { page: Page; redirect?: undefined } | { page?: undefined; redirect: string };
  }[] = [];
  if (ctx.mode === "dynamic") return paths;
  for (const page of (await ctx.getLoader()).getPages()) {
    // page URLs are encoded, like spaces in file names
    paths.push({
      params: { fumapressPage: decodeURI(page.url.slice(1)) || undefined },
      props: { page },
    });
  }
  const redirect = await rootRedirect(ctx);
  if (redirect !== undefined)
    paths.push({
      params: { fumapressPage: undefined },
      props: { redirect: ctx.withBase(redirect) },
    });
  return paths;
}

/** the static paths of `[...fumapressFile]`, the routes rendered at build time */
export async function fileStaticPaths(ctx: Context, adapter: boolean) {
  const paths: {
    params: { fumapressFile?: string };
    props: { GET: RouteHandler; params: RouteParams };
  }[] = [];
  for (const route of await getApiRoutes(ctx)) {
    if (route.render === "dynamic") {
      if (!adapter)
        throw new Error(
          `[Fumapress] the route "${route.path}" renders on request, add an adapter to Astro.`,
        );
      continue;
    }
    const { GET } = route;
    if (!GET) continue;
    for (const { pathname, params } of expandRoute(route.path, route.staticPaths).pages)
      paths.push({
        params: { fumapressFile: decodeURI(pathname.slice(1)) || undefined },
        props: { GET, params },
      });
  }
  return paths;
}

/** the route rendered on request at `path` (without the base path), with its params */
export async function matchApiRoute(
  ctx: Context,
  path: string,
): Promise<{ route: ApiRoute; params: RouteParams } | undefined> {
  for (const route of await getApiRoutes(ctx)) {
    if (route.render !== "dynamic") continue;
    const params = matchRoute(route.path, path);
    if (params) return { route, params };
  }
}

function isMethod(method: string): method is Method {
  return methods.some((item) => item === method);
}

/** the response of `route` by the method of `request`, `HEAD` falls back to `GET` */
async function dispatch(route: ApiRoute, request: Request, params: RouteParams): Promise<Response> {
  const { method } = request;
  const handler =
    (isMethod(method) ? route[method] : undefined) ??
    (method === "HEAD" ? route.GET : undefined) ??
    route.ALL;
  if (handler) return handler(request, { params });

  const allow: Method[] = [];
  for (const item of methods) if (route[item]) allow.push(item);
  return new Response(null, { status: 405, headers: { Allow: allow.join(", ") } });
}

/** the response of `[...fumapressServer]`: the routes rendered on request, or the page to render in `dynamic` mode */
export async function serve(ctx: Context, request: Request): Promise<Response | Page> {
  const path = stripBase(new URL(request.url).pathname, ctx.withBase("/"));
  if (path === undefined) return new Response(null, { status: 404 });
  const match = await matchApiRoute(ctx, path);
  if (match) return dispatch(match.route, request, match.params);

  if (ctx.mode === "dynamic") {
    // like the URLs of pages
    const page = (await ctx.getLoader()).getPageByUrl(path.replace(/(.)\/$/, "$1"));
    if (page) return page;
    const redirect = path === "/" ? await rootRedirect(ctx) : undefined;
    if (redirect !== undefined)
      return new Response(null, { status: 302, headers: { Location: ctx.withBase(redirect) } });
  }
  // a page rather than an endpoint: its 404 without body renders the 404 page
  return new Response(null, { status: 404 });
}
