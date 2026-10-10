/** Join paths with `/`, the first one is kept as-is (e.g. a base URL) */
export function joinPaths(...paths: string[]): string {
  let out = paths[0] ?? "";
  for (let i = 1; i < paths.length; i++) {
    let p = paths[i]!;
    if (p.startsWith("/")) p = p.slice(1);
    if (p.endsWith("/")) p = p.slice(0, -1);
    // skip empty and `.` segments, e.g. a relative `BASE_URL` of `./`
    if (p.length === 0 || p === ".") continue;

    out = out.endsWith("/") ? out + p : `${out}/${p}`;
  }

  return out;
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

/** decode a percent-encoded pathname (the router passes URL segments as-is on dynamic requests), unchanged when malformed */
export function decodePathname(pathname: string): string {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return pathname;
  }
}
