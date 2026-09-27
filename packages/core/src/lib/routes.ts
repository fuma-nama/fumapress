export type RouteParams = Record<string, string | string[]>;

/**
 * A route as Waku.js serves it: its URL pattern without route groups, and its pages with their
 * concrete pathname and route params, one per entry of `staticPaths` when the path has slugs, the
 * path itself otherwise. An `exactPath` route is one page at its literal path.
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
