/** the docs of each framework, at `/docs/<framework>` */
export const frameworks = {
  waku: { title: "Waku", description: "Fumapress on Waku", icon: "Box" },
  astro: { title: "Astro", description: "Fumapress on Astro", icon: "Orbit" },
};

/** the framework of a docs URL */
export function frameworkOf(url: string): keyof typeof frameworks | undefined {
  if (/^\/docs\/astro(?:\/|$)/.test(url)) return "astro";
  if (/^\/docs\/waku(?:\/|$)/.test(url)) return "waku";
}
