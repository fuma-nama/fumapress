import type { Plugin } from "../core/plugin";
import type { Page, PageModule, StructuredData } from "../core/types";

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

/** the text of a page from its headings and the content under each */
function textOf(page: Page, data: StructuredData): string {
  const lines = [`# ${typeof page.data.title === "string" ? page.data.title : page.url}`];
  const headings = new Map(data.headings.map((heading) => [heading.id, heading.content]));
  let current: string | undefined;
  for (const { heading, content } of data.contents) {
    if (heading !== current) {
      current = heading;
      if (heading !== undefined && headings.has(heading)) lines.push(`## ${headings.get(heading)}`);
    }
    lines.push(content);
  }
  return lines.join("\n\n");
}

/** renders the pages of collections: the Markdown files the Vite plugin compiled to modules */
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
    async getPageText(page) {
      const data = (await moduleOf(page)?.load())?.structuredData;
      if (data) return textOf(page, data);
    },
  };
}
