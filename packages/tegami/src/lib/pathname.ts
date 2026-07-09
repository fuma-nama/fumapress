/** Join multiple (full) pathnames */
export function joinPathname(...paths: string[]): string {
  const segs: string[] = [];
  for (let p of paths) {
    if (p.startsWith("/")) p = p.slice(1);
    if (p.endsWith("/")) p = p.slice(0, -1);
    if (p.length > 0) segs.push(p);
  }
  return `/${segs.join("/")}`;
}
