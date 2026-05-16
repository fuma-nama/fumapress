export function joinPathname(...paths: string[]): string {
  const segs = paths.join("/").split(/\/+/);
  if (segs.length > 0 && segs[0]!.length === 0) segs.shift();
  if (segs.length > 0 && segs[segs.length - 1]!.length === 0) segs.pop();
  return "/" + segs.join("/");
}
