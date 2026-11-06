/** the framework of a docs URL, each has its own docs: Waku without a prefix */
export function frameworkOf(url: string) {
  if (/^\/docs\/astro(?:\/|$)/.test(url)) return "astro";
  if (/^\/docs(?:\/|$)/.test(url)) return "waku";
}
