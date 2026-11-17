import type { Plugin } from "../core/plugin";
import type { Page } from "../core/types";

export interface LLMsOptions {
  /** the index of the pages @defaultValue "/llms.txt" */
  path?: string;
  /** the text of every page in one file, `false` for none @defaultValue "/llms-full.txt" */
  full?: string | false;
  /** the content pages to list, in both files: a page it returns `false` for is left out */
  filter?: (page: Page) => boolean;
}

const markdown = { headers: { "Content-Type": "text/markdown; charset=utf-8" } };

/** a text of a page on one line of a list, where it can't start a link or an item of its own */
const inline = (text: string) => text.replace(/\s+/g, " ").replace(/[[\]()]/g, "\\$&");

/**
 * `/llms.txt` and `/llms-full.txt` for LLMs, per language at its prefix: generated at build time, or on demand with a
 * dynamic source.
 */
export function llmsPlugin({
  path = "/llms.txt",
  full = "/llms-full.txt",
  filter,
}: LLMsOptions = {}): Plugin {
  return {
    name: "core:llms",
    routes({ createApi }) {
      const render = this.getContentRender();
      const pagesOf = (lang: string) =>
        this.getPages(lang).filter((page) => filter?.(page) ?? true);

      // the default language is at the root of the site, where the files are looked for
      const at = (lang: string, file: string) =>
        lang === this.defaultLanguage ? file : this.localizePath(lang, file);

      for (const lang of this.languages) {
        createApi({
          path: at(lang, path),
          render,
          GET: async () => {
            const lines = [`# ${this.site.name ?? "Docs"}`, ""];
            if (this.site.description) lines.push(`> ${this.site.description}`, "");
            for (const page of pagesOf(lang)) {
              const { title, description } = await this.getPageData(page);
              lines.push(
                `- [${inline(title ?? page.url)}](${this.absoluteUrl(page.url)})${description ? `: ${inline(description)}` : ""}`,
              );
            }
            return new Response(`${lines.join("\n")}\n`, markdown);
          },
        });

        if (full === false) continue;
        createApi({
          path: at(lang, full),
          render,
          GET: async () => {
            // a page without text, like one of a source with no `getPageText`, is left out
            const texts = await Promise.all(pagesOf(lang).map((page) => this.getPageText(page)));
            return new Response(`${texts.filter(Boolean).join("\n\n---\n\n")}\n`, markdown);
          },
        });
      }
    },
  };
}
