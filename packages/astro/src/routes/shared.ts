import { stripBase, type PageRoute } from "@fumapress/core";
import {
  expandRoute,
  getPageRoutesWithDerived,
  matchPageRoute,
  matchRoute,
  rootRedirect,
  methods,
  type RuntimeContext,
  type ServedRoute,
} from "@fumapress/core/runtime";
import type { ApiRoute, RouteHandler, RouteParams } from "@fumapress/core";
import type { Method } from "fumadocs-core/framework/plugin";
import type { Page } from "fumadocs-core/source";

/** a view at one of the pages of its route */
export interface ViewPage {
  route: ServedRoute;
  page: PageRoute["pages"][number];
}

/** the props of `[...fumapressPage]` and the pages of `[...fumapressServer]`: a content page, a view, or a redirect */
export interface PageProps {
  page?: Page;
  view?: ViewPage;
  redirect?: string;
}

/** the view rendered on request at `path` (without the base path), with its translations when its route lists the path */
export async function matchView(ctx: RuntimeContext, path: string): Promise<ViewPage | undefined> {
  const match = matchPageRoute(
    await getPageRoutesWithDerived(ctx),
    path,
    (route) => route.view !== undefined && route.render === "dynamic",
  );
  if (!match) return;
  const { route, params } = match;
  // the pages of routes have decoded paths, `matchRoute()` decoded every segment already
  const decoded = decodeURI(path);
  return {
    route,
    page: route.pages.find((page) => page.path === decoded) ?? {
      path: decoded,
      translations: [],
      params,
    },
  };
}

/** whether a route of plugins serves `path` (without the base path), with or without the trailing slash */
export async function isApiRoute(ctx: RuntimeContext, path: string): Promise<boolean> {
  const trimmed = path.replace(/(.)\/$/, "$1");
  for (const route of await ctx.getApiRoutes()) {
    if (
      route.render === "dynamic"
        ? matchRoute(route.path, trimmed)
        : expandRoute(route.path, route.staticPaths).pages.some((page) => page.pathname === trimmed)
    )
      return true;
  }
  return false;
}

/** the static paths of `[...fumapressPage]`, no pages in `dynamic` mode */
export async function pageStaticPaths(ctx: RuntimeContext, adapter: boolean) {
  const paths: { params: { fumapressPage?: string }; props: PageProps }[] = [];
  if (ctx.mode === "dynamic") return paths;
  const routes = await getPageRoutesWithDerived(ctx);
  for (const { view, render } of routes) {
    if (view && render === "dynamic" && !adapter)
      throw new Error(
        `[Fumapress] the route "${view.path}" renders on request, add an adapter to Astro.`,
      );
  }
  for (const page of (await ctx.getLoader()).getPages()) {
    // page URLs are encoded, like spaces in file names
    paths.push({
      params: { fumapressPage: decodeURI(page.url.slice(1)) || undefined },
      props: { page },
    });
  }
  for (const route of routes) {
    if (!route.view || route.render === "dynamic") continue;
    for (const page of route.pages) {
      // `404.astro` renders the view at `/404`
      if (page.path !== "/404")
        paths.push({
          params: { fumapressPage: page.path.slice(1) || undefined },
          props: { view: { route, page } },
        });
    }
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
export async function fileStaticPaths(ctx: RuntimeContext, adapter: boolean) {
  const paths: {
    params: { fumapressFile?: string };
    props: { GET: RouteHandler; params: RouteParams };
  }[] = [];
  for (const route of await ctx.getApiRoutes()) {
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
  ctx: RuntimeContext,
  path: string,
): Promise<{ route: ApiRoute; params: RouteParams } | undefined> {
  for (const route of await ctx.getApiRoutes()) {
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

/** the response of the route of plugins rendered on request at the URL of `request` */
export async function serveApi(
  ctx: RuntimeContext,
  request: Request,
): Promise<Response | undefined> {
  const path = stripBase(new URL(request.url).pathname, ctx.withBase("/"));
  const match = path === undefined ? undefined : await matchApiRoute(ctx, path);
  if (match) return dispatch(match.route, request, match.params);
}

/** the page to render on request at the URL of `request` */
export async function serve(ctx: RuntimeContext, request: Request): Promise<PageProps | undefined> {
  const path = stripBase(new URL(request.url).pathname, ctx.withBase("/"));
  if (path === undefined) return;

  // like the URLs of pages
  const trimmed = path.replace(/(.)\/$/, "$1");
  const view = await matchView(ctx, trimmed);
  if (view) return { view };
  if (ctx.mode !== "dynamic") return;
  const page = (await ctx.getLoader()).getPageByUrl(trimmed);
  if (page) return { page };
  const redirect = path === "/" ? await rootRedirect(ctx) : undefined;
  if (redirect !== undefined) return { redirect: ctx.withBase(redirect) };
}
