import type { ApiRoute } from "./plugin";

/**
 * Paths have one form inside the site: decoded, with single slashes and without a trailing one, like `/guide/my page`.
 * A URL is decoded once where it comes in ({@link decodePath}) and encoded once where it goes out
 * ({@link encodePath}), so a page has one path, whatever a request spells it like.
 */

/** a path of the site tidied up: single slashes, no trailing one. It is not decoded: see {@link decodePath}. */
export function normalizePath(path: string): string {
  const out = path.replace(/\/{2,}/g, "/").replace(/\/$/, "");
  return out === "" ? "/" : out;
}

/**
 * The path of a URL's pathname, none when it can't name a page: a malformed escape, or an encoded separator like
 * `%2F`, which would make one page reachable under two paths.
 */
export function decodePath(pathname: string): string | undefined {
  const segments: string[] = [];
  for (const segment of pathname.split("/")) {
    if (segment === "") continue;
    let decoded: string;
    try {
      decoded = decodeURIComponent(segment);
    } catch {
      return;
    }
    if (/[/\\]/.test(decoded)) return;
    segments.push(decoded);
  }
  return `/${segments.join("/")}`;
}

/** a path as a URL's pathname */
export function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

/**
 * A URL a link can lead to: a path, a hash, or a URL to the web or to mail and phone apps. A link from content, like
 * one of a remote source, could otherwise run a script (`javascript:`), which Vue renders as it is.
 */
export function safeHref(href: string): string | undefined {
  // browsers skip white space and control characters in front of a scheme, and inside it
  // oxlint-disable-next-line no-control-regex
  const scheme = /^[\s\u0000-\u001f]*([a-z][a-z0-9+.\-\s]*):/i.exec(href)?.[1];
  if (scheme === undefined) return href;
  return /^(https?|mailto|tel)$/i.test(scheme.replace(/\s/g, "")) ? href : undefined;
}

const param = /^\[(\w+)\]$/;
const rest = /^\[\.\.\.(\w+)\]$/;

/** whether a pattern has a param: it then matches paths that are not known ahead */
export function hasParams(pattern: string): boolean {
  return pattern.split("/").some((part) => param.test(part) || rest.test(part));
}

/**
 * Checks the pattern of a route when it is created: a param is a whole segment, and a rest param is the last one. A
 * pattern like `/data/[id].json` would otherwise be a literal path that matches nothing.
 */
export function validateRoute(pattern: string, isStatic: boolean): void {
  const parts = pattern.split("/").filter(Boolean);
  const fail = (reason: string): never => {
    throw new Error(`[Fumapress] The route "${pattern}" is invalid: ${reason}.`);
  };
  if (!pattern.startsWith("/")) fail("a path starts with `/`");

  let params = 0;
  for (const [i, part] of parts.entries()) {
    if (param.test(part) || rest.test(part)) params++;
    else if (/[[\]]/.test(part)) {
      fail(
        `a param is a whole segment, like \`/[name]/${part.replace(/\[[^\]]*\]/g, "") || "x"}\``,
      );
    }
    if (rest.test(part) && i !== parts.length - 1) fail("a rest param is the last segment");
  }
  if (isStatic && params > 1) fail("a static route has one param, whose values are `staticPaths`");
}

/** the params of a path matching a route: `[name]` matches a segment, `[...name]` the rest of the path */
export function matchRoute(pattern: string, path: string): Record<string, string> | undefined {
  const parts = pattern.split("/").filter(Boolean);
  const segments = path.split("/").filter(Boolean);
  const params: Record<string, string> = {};

  for (const [i, part] of parts.entries()) {
    const restName = rest.exec(part)?.[1];
    if (restName) {
      params[restName] = segments.slice(i).join("/");
      return params;
    }
    const segment = segments[i];
    if (segment === undefined) return;
    const name = param.exec(part)?.[1];
    if (name) params[name] = segment;
    else if (part !== segment) return;
  }
  if (segments.length === parts.length) return params;
}

/** the paths a static route generates: its own without a param, one per entry of `staticPaths` with one */
export async function staticPathsOf(
  route: Pick<ApiRoute, "path" | "staticPaths">,
): Promise<string[]> {
  const parts = route.path.split("/");
  const index = parts.findIndex((part) => param.test(part) || rest.test(part));
  if (index === -1) return [route.path];

  const values =
    typeof route.staticPaths === "function" ? await route.staticPaths() : (route.staticPaths ?? []);
  return values.map((value) => {
    const segments = Array.isArray(value) ? value : [value];
    return [...parts.slice(0, index), ...segments, ...parts.slice(index + 1)].join("/");
  });
}

/** where the browser requests the content of a page, by its URL: a route of the `core:pages` plugin */
const PAGE_DATA = "/_press/pages";
export const PAGE_DATA_ROUTE = `${PAGE_DATA}/[...path]`;

export function pageDataPath(url: string): string {
  return `${PAGE_DATA}${url === "/" ? "/index" : url}.json`;
}

/** the `path` param of the route for the data of a page, by segment */
export function pageDataParam(url: string): string[] {
  return pageDataPath(url)
    .slice(PAGE_DATA.length + 1)
    .split("/");
}

/** the URL of the page a {@link pageDataPath} is for, from the `path` param of its route */
export function pageOfDataParam(path: string): string | undefined {
  const match = /^(.*)\.json$/.exec(path);
  if (match) return match[1] === "index" ? "/" : `/${match[1]}`;
}

/** the data every page of a language needs, like its page tree: a shared data route of the `core:pages` plugin */
export function siteDataPath(lang: string): string {
  return `/_press/site/${lang}.json`;
}

/** the search index of a language, searched in the browser: a data route of the `core:search` plugin */
export function searchIndexPath(lang: string): string {
  return `/_press/search/${lang}.json`;
}

/**
 * Lists the paths to generate at build time, in parts: Nitro reads them from the `x-nitro-prerender` header of each
 * part, which names the next one. A header has a size limit, so a site of any size needs more than one.
 */
export const PRERENDER_ROUTE = "/_press/routes/[part]";

export function prerenderListPath(part: number): string {
  return `/_press/routes/${part}.txt`;
}
