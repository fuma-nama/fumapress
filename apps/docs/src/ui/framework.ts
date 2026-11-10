/** the docs of each framework, Waku at `/docs` and the others at `/docs/<framework>` */
export const frameworks = {
  waku: { title: "Waku", description: "Fumapress on Waku", icon: "Box" },
  astro: { title: "Astro", description: "Fumapress on Astro", icon: "Orbit" },
};

/** the framework of a docs URL */
export function frameworkOf(url: string): keyof typeof frameworks | undefined {
  if (/^\/docs\/astro(?:\/|$)/.test(url)) return "astro";
  if (/^\/docs(?:\/|$)/.test(url)) return "waku";
}

/** the URL of a page in the docs of a framework, `path` like `/plugins/seo` */
export function docsUrl(framework: keyof typeof frameworks, path = ""): string {
  return (framework === "waku" ? "/docs" : `/docs/${framework}`) + path;
}
