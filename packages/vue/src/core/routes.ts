import type { ApiRoute } from "./plugin";

/** a path without a trailing slash, decoded: the form of page URLs */
export function normalizePath(pathname: string): string {
  const path = decodeURI(pathname).replace(/\/+$/, "");
  return path === "" ? "/" : path;
}

const param = /^\[(\w+)\]$/;
const rest = /^\[\.\.\.(\w+)\]$/;

/** the params of a path matching a route: `[name]` matches a segment, `[...name]` the rest of the path */
export function matchRoute(pattern: string, pathname: string): Record<string, string> | undefined {
  const parts = pattern.split("/").filter(Boolean);
  const segments = pathname.split("/").filter(Boolean);
  const params: Record<string, string> = {};

  for (const [i, part] of parts.entries()) {
    const restName = rest.exec(part)?.[1];
    if (restName) {
      params[restName] = segments.slice(i).map(decodeURIComponent).join("/");
      return params;
    }
    const segment = segments[i];
    if (segment === undefined) return;
    const name = param.exec(part)?.[1];
    if (name) params[name] = decodeURIComponent(segment);
    else if (part !== segment) return;
  }
  if (segments.length === parts.length) return params;
}

/** the paths a static route generates: its own without a param, one per entry of `staticPaths` with one */
export async function staticPathsOf(route: ApiRoute): Promise<string[]> {
  const parts = route.path.split("/");
  const index = parts.findIndex((part) => param.test(part) || rest.test(part));
  if (index === -1) return [route.path];

  const values =
    typeof route.staticPaths === "function" ? await route.staticPaths() : (route.staticPaths ?? []);
  return values.map((value) => {
    const segments = (Array.isArray(value) ? value : [value]).map(encodeURIComponent);
    return [...parts.slice(0, index), ...segments, ...parts.slice(index + 1)].join("/");
  });
}

/** where the browser requests the content of a page, by its URL: a route of the `core:pages` plugin */
export const PAGE_DATA_ROUTE = "/_press/pages/[...path]";

export function pageDataPath(url: string): string {
  return `/_press/pages${url === "/" ? "/index" : url}.json`;
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
