import { stripBase, type PageRoute } from "@fumapress/core";
import {
  expandRoute,
  matchRoute,
  rootRedirect,
  type RoutedView,
  type RuntimeContext,
} from "@fumapress/core/runtime";
import {
  methods,
  type ApiRoute,
  type Method,
  type RouteHandler,
  type RouteParams,
} from "fumadocs-core/framework/plugin";
import type { Page } from "fumadocs-core/source";
import type { PageTarget } from "../ui/page";

const staticPaths = new WeakMap<ApiRoute[], Set<string>>();

/** a view at one of the pages of its route */
export interface ViewPage extends RoutedView {
  page: PageRoute["pages"][number];
}

/** the props of `[...fumapressPage]` and the pages of `[...fumapressServer]`: a content page, a view, or a redirect */
export interface PageProps {
  page?: Page;
  view?: ViewPage;
  redirect?: string;
}

/** what `Page.astro` renders for `props`, or the response of a redirect, or a 404 for a view without content */
export async function pageTarget(
  { page, view, redirect }: PageProps,
  request: Request,
): Promise<PageTarget | Response> {
  if (redirect !== undefined)
    return new Response(null, { status: 302, headers: { Location: redirect } });
  if (page) return { page };
  if (view) {
    const { params } = view.page;
    const content =
      view.view.render === "dynamic"
        ? await view.view.view(params, { request })
        : await view.view.view(params);
    if (content) return { view, content };
  }
  return new Response(null, { status: 404 });
}

/** the view rendered on request at `path` (without the base path), with its translations when its route lists the path */
export async function matchView(ctx: RuntimeContext, path: string): Promise<ViewPage | undefined> {
  for (const routed of await ctx.getViewRoutes()) {
    const { route } = routed;
    if (route.render !== "dynamic") continue;
    const params = matchRoute(route.path, path);
    if (!params) continue;
    // the pages of routes have decoded paths, `matchRoute()` decoded every segment already
    const decoded = decodeURI(path);
    return {
      ...routed,
      page: route.pages.find((page) => page.path === decoded) ?? {
        path: decoded,
        translations: [],
        params,
      },
    };
  }
}

/** whether a route of plugins serves `path` (without the base path), with or without the trailing slash */
export async function isApiRoute(ctx: RuntimeContext, path: string): Promise<boolean> {
  const list = await ctx.getApiRoutes();
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
export async function pageStaticPaths(ctx: RuntimeContext, adapter: boolean) {
  const paths: { params: { fumapressPage?: string }; props: PageProps }[] = [];
  if (ctx.mode === "dynamic") return paths;
  for (const { route, view } of await ctx.getViewRoutes()) {
    if (route.render === "dynamic" && !adapter)
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
  for (const routed of await ctx.getViewRoutes()) {
    if (routed.route.render === "dynamic") continue;
    for (const page of routed.route.pages) {
      // `404.astro` renders the view at `/404`
      if (page.path !== "/404")
        paths.push({
          params: { fumapressPage: page.path.slice(1) || undefined },
          props: { view: { ...routed, page } },
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

/** the response of `[...fumapressServer]`: the routes rendered on request, or the page to render on request */
export async function serve(ctx: RuntimeContext, request: Request): Promise<Response | PageProps> {
  const path = stripBase(new URL(request.url).pathname, ctx.withBase("/"));
  if (path === undefined) return new Response(null, { status: 404 });
  const match = await matchApiRoute(ctx, path);
  if (match) return dispatch(match.route, request, match.params);

  // like the URLs of pages
  const trimmed = path.replace(/(.)\/$/, "$1");
  const view = await matchView(ctx, trimmed);
  if (view) return { view };
  if (ctx.mode === "dynamic") {
    const page = (await ctx.getLoader()).getPageByUrl(trimmed);
    if (page) return { page };
    const redirect = path === "/" ? await rootRedirect(ctx) : undefined;
    if (redirect !== undefined) return { redirect: ctx.withBase(redirect) };
  }
  // a page rather than an endpoint: its 404 without body renders the 404 page
  return new Response(null, { status: 404 });
}

/**
 * The URL with `/` of a file that a route of plugins renders on request, like `/robots.txt` in `dynamic` mode. With
 * `trailingSlash: "always"`, Astro doesn't add the slash to files, but `[...fumapressServer]` takes them only with it.
 */
export async function serverFileUrl(ctx: RuntimeContext, url: URL): Promise<URL | undefined> {
  const path = stripBase(url.pathname, ctx.withBase("/"));
  if (!path || !/\.[^/]+$/.test(path) || !(await matchApiRoute(ctx, path))) return;
  const out = new URL(url);
  out.pathname += "/";
  return out;
}
