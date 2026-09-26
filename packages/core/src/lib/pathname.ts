/** Join multiple (full) pathnames */
export function joinPathname(...paths: string[]): string {
  const segs: string[] = [];
  for (let p of paths) {
    if (p.startsWith("/")) p = p.slice(1);
    if (p.endsWith("/")) p = p.slice(0, -1);
    if (p.length > 0) segs.push(p);
  }

  return "/" + segs.join("/");
}

const PATHNAME_SEGMENT_REGEX = /^[A-Za-z0-9\-._~!$&'()*+,;=:@]+$/;

/** Check if the string is a full pathname (one that does not include `.` or `..`) */
export function isFullPathname(s: string) {
  return (
    s.startsWith("/") &&
    s
      .slice(1)
      .split("/")
      .every((seg) => seg !== "." && seg !== ".." && PATHNAME_SEGMENT_REGEX.test(seg))
  );
}

/** Append a trailing slash to the pathname of `href`, before its query and hash */
export function withTrailingSlash(href: string): string {
  const end = href.search(/[?#]/);
  const pathname = end === -1 ? href : href.slice(0, end);
  if (pathname.length === 0 || pathname.endsWith("/")) return href;

  return pathname + "/" + (end === -1 ? "" : href.slice(end));
}

/**
 * Apply `site.trailingSlash` to a link: only site-root links to pages are affected, files (a `.` in
 * the last segment), external URLs, and bare `?query` or `#hash` links are kept as is.
 */
export function withPageTrailingSlash(href: string): string {
  if (!href.startsWith("/") || href.startsWith("//")) return href;

  const end = href.search(/[?#]/);
  const pathname = end === -1 ? href : href.slice(0, end);
  if (pathname.slice(pathname.lastIndexOf("/")).includes(".")) return href;

  return withTrailingSlash(href);
}

/** add base URL to pathname */
export function resolveBaseUrl(base: string, pathname: string) {
  if (base.endsWith("/")) base = base.slice(0, -1);
  if (pathname.startsWith("/")) pathname = pathname.slice(1);
  return `${base}/${pathname}`;
}
