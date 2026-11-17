import type { AppShape, Plugin } from "../core/plugin";
import type { PageModule } from "../core/types";

/** the compiled module of a Markdown file, on the data of a page of a collection */
export interface ModuleRef {
  /** the path of the file from the project root */
  file: string;
  /** the module on the server */
  load: () => Promise<PageModule>;
  /** its file in the browser build: `entry` is the URL the browser imports */
  assets: () => Promise<{ entry: string }>;
}

/**
 * The key of the `ModuleRef` on `page.data`: a symbol, so the data of a page stays its frontmatter, and JSON leaves it
 * out. `Symbol.for`, so each entry of the build that has a copy of this module reads the same key.
 */
export const moduleKey: unique symbol = Symbol.for("fumapress:module");

function moduleOf(page: AppShape["page"]): ModuleRef | undefined {
  // a page of any source: only those of collections have it
  return (page.data as { [moduleKey]?: ModuleRef })[moduleKey];
}

/**
 * Renders the pages of collections: the Markdown files the Vite plugin compiled to modules. A page's date is its
 * `lastModified`, which a collection with `lastModified: true` reads from git.
 */
export function markdownPlugin(): Plugin {
  return {
    name: "core:markdown",
    transformPage(_data, { page }) {
      const ref = page && moduleOf(page);
      const { git } = this.site;
      if (!ref || !git) return;
      const file = [git.dir, ref.file].filter(Boolean).join("/");
      return {
        githubUrl: `https://github.com/${git.user}/${git.repo}/blob/${git.branch ?? "main"}/${file}`,
      };
    },
    async getPageBody(page) {
      const ref = moduleOf(page);
      if (ref) return { module: (await ref.assets()).entry, load: ref.load };
    },
    async getPageToc(page) {
      return (await moduleOf(page)?.load())?.toc;
    },
    async getPageStructuredData(page) {
      return (await moduleOf(page)?.load())?.structuredData;
    },
    getPageLastModified(page) {
      const value: unknown = Reflect.get(page.data, "lastModified");
      if (moduleOf(page) && value instanceof Date) return value;
    },
    async getPageText(page) {
      const markdown = (await moduleOf(page)?.load())?.markdown;
      if (markdown === undefined) return;
      const title = typeof page.data.title === "string" ? page.data.title : page.url;
      return `# ${title}\n\n${markdown.trim()}`;
    },
  };
}
