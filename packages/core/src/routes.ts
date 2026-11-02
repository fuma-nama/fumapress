import type { RouteParams } from "fumadocs-core/framework/plugin";

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
