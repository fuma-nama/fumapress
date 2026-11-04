import type { Method } from "fumadocs-core/framework/plugin";
import { findPath } from "fumadocs-core/page-tree";
import type { Context, RoutedView, RuntimeContext } from "./context";
import type { AppShape, PageRoute, RouteParams } from "./plugin";

export const methods: readonly Method[] = [
  "GET",
  "HEAD",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS",
];

/** `pathname` without the base path `base` (`withBase('/')`), `undefined` outside of it */
export function stripBase(pathname: string, base: string): string | undefined {
  if (base === "/") return pathname;
  if (pathname === base) return "/";
  if (pathname.startsWith(`${base}/`)) return pathname.slice(base.length);
}

/**
 * A route's URL pattern without route groups (`(name)`), and its pages with their concrete
 * pathname and route params, one per entry of `staticPaths` when the path has params, the path
 * itself otherwise. An `exactPath` route is one page at its literal path.
 */
export function expandRoute(
  path: string,
  staticPaths: readonly string[] | readonly string[][] | undefined,
  exactPath = false,
): { pattern: string; pages: { pathname: string; params: RouteParams }[] } {
  const segments: string[] = [];
  for (const seg of path.split("/")) if (seg && !seg.startsWith("(")) segments.push(seg);
  const pattern = "/" + segments.join("/");
  const pages: { pathname: string; params: RouteParams }[] = [];

  if (exactPath || !segments.some((seg) => seg.startsWith("["))) {
    pages.push({ pathname: pattern, params: {} });
    return { pattern, pages };
  }

  for (const entry of staticPaths ?? []) {
    const values = typeof entry === "string" ? [entry] : entry;
    const params: RouteParams = {};
    let pathname = "";
    let i = 0;

    for (const seg of segments) {
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

    pages.push({ pathname: pathname || "/", params });
  }

  return { pattern, pages };
}

/**
 * The route params of `pathname` when it matches `pattern`, the inverse of {@link expandRoute}:
 * `[name]` is one segment, `[...name]` the rest (zero or more segments), a trailing slash is ignored.
 */
export function matchRoute(pattern: string, pathname: string): RouteParams | undefined {
  const segments: string[] = [];
  try {
    for (const seg of pathname.split("/")) if (seg) segments.push(decodeURIComponent(seg));
  } catch {
    // a malformed escape matches no route
    return;
  }

  const params: RouteParams = {};
  let i = 0;
  for (const part of pattern.split("/")) {
    if (!part) continue;
    if (part.startsWith("[...") && part.endsWith("]")) {
      params[part.slice(4, -1)] = segments.slice(i);
      return params;
    }

    const value = segments[i++];
    if (value === undefined) return;
    if (part.startsWith("[") && part.endsWith("]")) params[part.slice(1, -1)] = value;
    else if (part !== value) return;
  }
  if (i === segments.length) return params;
}

/**
 * Localizes the pages of routes: `pathname` (without the language prefix) in `lang`, the pages of
 * other languages at the same pathname are its translations. Call it for every page of the routes.
 */
export function createLocalizer(
  ctx: Context,
): (
  lang: string | undefined,
  pathname: string,
) => Pick<PageRoute["pages"][number], "path" | "translations"> {
  const translations = new Map<string, PageRoute["pages"][number]["translations"]>();
  return (lang, pathname) => {
    let siblings = translations.get(pathname);
    if (!siblings) translations.set(pathname, (siblings = []));
    const path = ctx.localizePath(lang, pathname);
    if (lang) siblings.push({ lang, path });
    return { path, translations: siblings };
  };
}

/** static segments (and a path ending), then params, then rest params */
function segmentRank(segment = ""): number {
  if (segment.startsWith("[...")) return 2;
  return segment.startsWith("[") ? 1 : 0;
}

/** sorts route patterns by specificity, the most specific first, like the routers of frameworks */
export function compareRoutes(a: string, b: string): number {
  const x = a.split("/");
  const y = b.split("/");
  for (let i = 1; i < Math.max(x.length, y.length); i++) {
    const diff = segmentRank(x[i]) - segmentRank(y[i]);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** whether one of `routes` has a page at `path` */
function hasPage(routes: { pages: readonly { path: string }[] }[], path: string): boolean {
  return routes.some((route) => route.pages.some((page) => page.path === path));
}

/** the home of a language (without the base path): its `/`, or its first page when nothing is there */
export async function getHomeUrl(ctx: Context, lang: string | undefined): Promise<string> {
  const home = ctx.localizePath(lang, "/");
  const loader = await ctx.getLoader();
  if (loader.getPageByUrl(home, lang) || hasPage(await ctx.getRoutes(), home)) return home;
  // links of meta files aren't pages
  const path = findPath(
    loader.getPageTree(lang).children,
    (node) => node.type === "page" && loader.getPageByUrl(node.url, lang) !== undefined,
    { includeSeparator: false },
  );
  const page = path?.at(-1);
  return page?.type === "page" ? page.url : home;
}

/** where `/` redirects (without the base path) when every language has a URL prefix, unless you have a page there */
export async function rootRedirect(ctx: Context): Promise<string | undefined> {
  const i18n = ctx.i18nConfig;
  if (!i18n || i18n.hideLocale === "default-locale") return;
  if (hasPage(await ctx.getRoutes(), "/")) return;
  return getHomeUrl(ctx, i18n.defaultLanguage);
}

/** the language of `path` (without the base path) by its URL prefix, the default language without one */
export function pathLocale(ctx: Context, path: string): string | undefined {
  const prefix = path.split("/", 2)[1];
  return prefix && ctx.i18nConfig?.languages.includes(prefix)
    ? prefix
    : ctx.i18nConfig?.defaultLanguage;
}

/** the view at `/404` in `lang`, or in the default language: the 404 page of `lang` */
export async function notFoundView<C extends AppShape>(
  ctx: RuntimeContext<C>,
  lang: C["lang"],
): Promise<RoutedView<C> | undefined> {
  let found: RoutedView<C> | undefined;
  for (const routed of await ctx.getViewRoutes()) {
    if (routed.view.path !== "/404") continue;
    if (routed.route.lang === lang) return routed;
    if (routed.route.lang === ctx.i18nConfig?.defaultLanguage) found = routed;
  }
  return found;
}
