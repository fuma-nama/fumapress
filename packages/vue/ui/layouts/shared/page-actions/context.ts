export const cache = new Map<string, string>();

export function withBasePath(href: string) {
  // ignore external
  if (href.match(/^\w+:/) || href.startsWith("//")) return href;

  // only typed on Vite, destructuring would make Vite inline the whole env object
  const base = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? "";
  return base.replace(/\/$/, "") + href;
}
