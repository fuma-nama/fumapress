import {
  createLocalizer,
  expandRoute,
  matchRoute,
  rootRedirect,
  stripBase,
  type Context,
  type FrameworkPage,
  type ViewRoute,
} from "@fumapress/core";
import {
  methods,
  type ApiRoute,
  type Method,
  type RouteHandler,
  type RouteParams,
} from "fumadocs-core/framework/plugin";
import type { Page } from "fumadocs-core/source";

const staticPaths = new WeakMap<ApiRoute[], Set<string>>();

/** a view route at one of its pages, the pages of other languages at its `path` are the translations */
export interface ExpandedView extends FrameworkPage {
  route: ViewRoute;
  params: RouteParams;
}

/** the props of `[...fumapressPage]` and the pages of `[...fumapressServer]`: a content page, a view, or a redirect */
export interface PageProps {
  page?: Page;
  view?: ExpandedView;
  redirect?: string;
}

/** the pages of view routes at their localized paths */
export async function expandViews(ctx: Context): Promise<ExpandedView[]> {
  const out: ExpandedView[] = [];
  const localize = createLocalizer(ctx);
  for (const route of await ctx.getViewRoutes()) {
    for (const { pathname, params } of expandRoute(route.path, route.staticPaths).pages)
      out.push({ ...localize(route.lang, pathname), route, params });
  }
  return out;
}

/** the view rendered on request at `path` (without the base path) */
export async function matchView(ctx: Context, path: string): Promise<ExpandedView | undefined> {
  // with its translations when its route lists the path
  for (const view of await expandViews(ctx))
    if (view.route.render === "dynamic" && view.path === path) return view;
  for (const route of await ctx.getViewRoutes()) {
    if (route.render !== "dynamic") continue;
    const params = matchRoute(
      ctx.localizePath(route.lang, expandRoute(route.path, undefined).pattern),
      path,
    );
    if (params) return { path, translations: [], route, params };
  }
}

/** whether a route of plugins serves `path` (without the base path), with or without the trailing slash */
export async function isApiRoute(ctx: Context, path: string): Promise<boolean> {
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
export async function pageStaticPaths(ctx: Context, adapter: boolean) {
  const paths: { params: { fumapressPage?: string }; props: PageProps }[] = [];
  if (ctx.mode === "dynamic") return paths;
  for (const route of await ctx.getViewRoutes()) {
    if (route.render === "dynamic" && !adapter)
      throw new Error(
        `[Fumapress] the route "${route.path}" renders on request, add an adapter to Astro.`,
      );
  }
  for (const page of (await ctx.getLoader()).getPages()) {
    // page URLs are encoded, like spaces in file names
    paths.push({
      params: { fumapressPage: decodeURI(page.url.slice(1)) || undefined },
      props: { page },
    });
  }
  for (const view of await expandViews(ctx)) {
    if (view.route.render === "static")
      paths.push({ params: { fumapressPage: view.path.slice(1) || undefined }, props: { view } });
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
  ctx: Context,
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
export async function serve(ctx: Context, request: Request): Promise<Response | PageProps> {
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
    if (redirect !== undefined)
      return new Response(null, { status: 302, headers: { Location: ctx.withBase(redirect) } });
  }
  // a page rather than an endpoint: its 404 without body renders the 404 page
  return new Response(null, { status: 404 });
}
