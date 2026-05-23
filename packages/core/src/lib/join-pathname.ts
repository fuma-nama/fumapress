export function joinPathname(...paths: string[]): string {
  let combined = paths.join("/").replaceAll(/\/+/g, "/");
  if (!combined.startsWith("/")) combined = "/" + combined;
  if (combined.endsWith("/")) combined = combined.slice(0, -1);
  return combined;
}
