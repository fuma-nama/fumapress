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
