/** add base URL to pathname */
export function resolveBaseUrl(base: string, pathname: string) {
  if (base.endsWith("/")) base = base.slice(0, -1);
  if (pathname.startsWith("/")) pathname = pathname.slice(1);
  return `${base}/${pathname}`;
}
