import { createElement, type ReactNode } from "react";
import type { MDXComponents } from "mdx/types";
import { components } from "virtual:fumapress/island";
import { NoProcessedMarkdownError, type AstroPageData } from "@fumadocs/astro/source";
import type { Context, Plugin } from "@fumapress/core";
import type { StructuredData } from "fumadocs-core/mdx-plugins/remark-structure";
import type { Page, PageData } from "fumadocs-core/source";
import type { TOCItemType } from "fumadocs-core/toc";
import { AstroContent } from "./island/serialize";
import { Link } from "./ui/link";

/** the renderer from `load()`, like `MarkdownRenderer` of `@fumadocs/local-md` */
interface Renderer {
  structuredData: StructuredData;
  render: (components: MDXComponents) => Promise<RenderedBody>;
}

interface RenderedBody {
  body: ReactNode;
  toc: TOCItemType[];
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

/** by page, with a new page when content changes */
const rendered = new WeakMap<Page, Promise<RenderedBody | undefined>>();

/** the body of a page from a runtime content source, rendered once with the MDX components */
function render(ctx: Context, page: Page) {
  const { data } = page;
  if (isCollectionPage(data) || !isPageDataOf<RuntimePageData>(data, "load")) return;

  let result = rendered.get(page);
  if (!result) {
    const A = components.a ?? Link;
    result = Promise.all([data.load(), ctx.getLoader()]).then(([renderer, loader]) =>
      // other content sources have `load()` too
      !isRenderer(renderer)
        ? undefined
        : renderer.render({
            ...components,
            a: (props) =>
              createElement(A, {
                ...props,
                href: props.href && loader.resolveHref(props.href, page),
              }),
          }),
    );
    rendered.set(page, result);
    // a later render tries again
    result.catch(() => rendered.delete(page));
  }
  return result;
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
          node: createElement(AstroContent, { component: (await page.data.load()).body }),
        };
      const rendered = await render(this, page);
      if (rendered) return { node: rendered.body };
    },
    async getPageToc(page) {
      if (isCollectionPage(page.data)) return (await page.data.load()).toc;
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
  };
}
