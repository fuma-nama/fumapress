import { createElement, type ReactNode } from "react";
import type { MDXComponents } from "mdx/types";
import { components } from "virtual:fumapress/island";
import { NoProcessedMarkdownError, type AstroPageData } from "@fumadocs/astro/source";
import type { Context, Plugin } from "@fumapress/core";
import type { StructuredData } from "fumadocs-core/mdx-plugins/remark-structure";
import type { Page, PageData } from "fumadocs-core/source";
import { deserializePageTree } from "fumadocs-core/source/client";
import type { TOCItemType } from "fumadocs-core/toc";
import { createRelativeLink } from "fumadocs-ui/mdx";
import { pageTrees } from "./island/island";
import { AstroContent, pageTreeFiles } from "./island/serialize";

/** the renderer from `load()`, like `MarkdownRenderer` of `@fumadocs/local-md` */
interface Renderer {
  structuredData: StructuredData;
  render: (components: MDXComponents) => Promise<{ body: ReactNode; toc: TOCItemType[] }>;
}

/** the page data of runtime content sources, like `LocalMarkdownPage` of `@fumadocs/local-md` */
interface RuntimePageData extends PageData {
  /** the source file, not on generated pages like Python */
  content?: string;
  load: () => Promise<object>;
}

/** the page data of a content source, by one of its methods */
function isPageDataOf<T extends object>(data: object, method: keyof T): data is T {
  return typeof (data as T)[method] === "function";
}

/** pages of `toFumadocsSource()` */
function isCollectionPage(data: PageData): data is AstroPageData {
  return isPageDataOf<AstroPageData>(data, "getText");
}

function isRenderer(value: object): value is Renderer {
  return typeof (value as Partial<Renderer>).render === "function";
}

const results = new WeakMap<object, Promise<unknown>>();

/** `run()` once per `key`, except in dev where content changes */
function once<T>(key: object, run: () => Promise<T>): Promise<T> {
  if (import.meta.env.DEV) return run();
  let result = results.get(key) as Promise<T> | undefined;
  if (!result) results.set(key, (result = run()));
  return result;
}

/** `load()` of a collection page, its body and table of contents */
function loadOnce(data: AstroPageData) {
  return once(data, () => data.load());
}

/** the body of a page from a runtime content source, rendered with the MDX components */
function render(ctx: Context, page: Page) {
  const { data } = page;
  if (isCollectionPage(data) || !isPageDataOf<RuntimePageData>(data, "load")) return;

  return once(page, async () => {
    const renderer = await data.load();
    // other content sources have `load()` too
    if (!isRenderer(renderer)) return;
    const { a: Link } = components;
    return renderer.render({
      ...components,
      // `createRelativeLink()` takes function components, MDX components can be any element type
      a: createRelativeLink(
        await ctx.getLoader(),
        page,
        Link && ((props) => createElement(Link, props)),
      ),
    });
  });
}

/** a valid date, devalue can't serialize an invalid one */
function toDate(value: unknown): Date | undefined {
  if (!(value instanceof Date) && typeof value !== "string") return;
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) return date;
}

/**
 * Pages of Astro content collections, and of runtime content sources whose `page.data.load()` returns a renderer: Local Markdown, Local HTML, Obsidian and Python.
 *
 * Collection pages render as their `<Content />`. Runtime sources render with the MDX components, with relative links resolved. It is a default of the runtime, the last layer: the plugins of content sources like Obsidian and your plugins override it.
 */
export function contentSourcePlugin(): Plugin {
  return {
    name: "astro:content-source",
    async getPageBody(page) {
      if (isCollectionPage(page.data))
        return {
          node: createElement(AstroContent, { component: (await loadOnce(page.data)).body }),
        };
      const rendered = await render(this, page);
      if (rendered) return { node: rendered.body };
    },
    async getPageToc(page) {
      if (isCollectionPage(page.data)) return (await loadOnce(page.data)).toc;
      return (await render(this, page))?.toc;
    },
    getPageStructuredData({ data }) {
      if (isPageDataOf<{ structuredData: () => Promise<StructuredData> }>(data, "structuredData"))
        return data.structuredData();
    },
    async getPageText({ data, path }) {
      if (isCollectionPage(data)) {
        try {
          return await data.getText("processed");
        } catch (error) {
          if (error instanceof NoProcessedMarkdownError) return data.getText("raw");
          throw error;
        }
      }
      if (!isPageDataOf<RuntimePageData>(data, "load")) return;
      // the source of Markdown pages, the text of others like HTML
      if (data.content !== undefined && /\.mdx?$/.test(path)) return data.content;
      const renderer = await data.load();
      if (!isRenderer(renderer)) return;

      const { headings, contents } = renderer.structuredData;
      const lines: string[] = [];
      let heading: string | undefined;
      for (const item of contents) {
        if (item.heading !== heading) {
          heading = item.heading;
          const title = headings.find((entry) => entry.id === heading);
          if (title) lines.push(`## ${title.content}`);
        }
        lines.push(item.content);
      }
      return lines.join("\n\n");
    },
    getPageCreatedAt({ data }) {
      if ("date" in data) return toDate(data.date);
    },
    getPageLastModified({ data }) {
      // from the frontmatter, or `lastModified` of collections
      if ("lastModified" in data) return toDate(data.lastModified);
    },
    /** the page trees as files, fetched once by the island rather than in the props of every page */
    async routes({ createApi }) {
      const source = await this.getLoader();
      for (const lang of this.languages) {
        const tree = source.getPageTree(lang);
        const serialized = await source.serializePageTree(tree);
        const json = JSON.stringify(serialized);
        const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(json));
        let hex = "";
        for (const byte of new Uint8Array(hash, 0, 8)) hex += byte.toString(16).padStart(2, "0");
        // by the hash of its content: revalidated content has another URL
        const path = `/_fumapress/page-tree/${lang ?? "default"}.${hex}.json`;
        const url = this.withBase(path);
        pageTreeFiles.set(tree, url);
        // the island renders the deserialized tree on the server too, like in the browser
        pageTrees.set(url, deserializePageTree(serialized));
        createApi({
          path,
          render: "static",
          GET: () =>
            new Response(json, {
              headers: {
                "Content-Type": "application/json",
                "Cache-Control": "public, max-age=31536000, immutable",
              },
            }),
        });
      }
    },
  };
}
