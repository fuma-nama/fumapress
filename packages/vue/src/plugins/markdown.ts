import type { Plugin } from "../core/plugin";
import type { Page, PageModule } from "../core/types";

/** the compiled module of a Markdown file, in `data._module` of a page of a collection */
export interface ModuleRef {
  /** the path of the file from the project root */
  file: string;
  /** the module on the server */
  load: () => Promise<PageModule>;
  /** its file in the browser build: `entry` is the URL the browser imports */
  assets: () => Promise<{ entry: string }>;
}

function moduleOf(page: Page): ModuleRef | undefined {
  const ref = page.data._module;
  return typeof ref === "object" && ref !== null ? (ref as ModuleRef) : undefined;
}

/**
 * Renders the pages of collections: the Markdown files the Vite plugin compiled to modules. A page's date is the
 * `lastModified` of its frontmatter, which the Vite plugin can fill from git.
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
      const value = page.data.lastModified;
      if (!moduleOf(page) || value === undefined) return;
      const date = new Date(value as string);
      if (Number.isNaN(date.getTime())) {
        throw new Error(
          `[Fumapress] The \`lastModified\` of "${page.path}" is "${String(value)}", which is not a date: write it like \`2026-01-02\`.`,
        );
      }
      return date;
    },
    async getPageText(page) {
      const markdown = (await moduleOf(page)?.load())?.markdown;
      if (markdown === undefined) return;
      const title = typeof page.data.title === "string" ? page.data.title : page.url;
      return `# ${title}\n\n${markdown.trim()}`;
    },
  };
}
