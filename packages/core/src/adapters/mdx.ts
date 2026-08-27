import { createElement } from "react";
import type { Adapter, Awaitable } from "@/lib/types";
import type { AsyncDocCollectionEntry, DocCollectionEntry } from "fumadocs-mdx/runtime/server";
import defaultMdxComponents, { createRelativeLink } from "fumadocs-ui/mdx";
import type { MDXComponents, MDXContent } from "mdx/types";
import type { AppContext, AppShape } from "@/app/context";
import { z } from "zod/mini";

export interface MdxAdapterOptions<C extends AppShape = AppShape> {
  getMdxComponents?: (this: AppContext<C>, page: C["page"]) => Awaitable<MDXComponents>;
}

export function fumadocsMdx<C extends AppShape = AppShape>(
  options?: MdxAdapterOptions<C>,
): Adapter<C> {
  const getMdxComponents =
    options?.getMdxComponents ??
    async function (page) {
      return {
        ...defaultMdxComponents,
        a: createRelativeLink(await this.getLoader(), page),
      };
    };

  return {
    async "core:get-text"(page) {
      if (isAsyncEntry(page.data) || isSyncEntry(page.data)) {
        return page.data.getText("processed");
      }
    },
    async "core:get-structured-data"(page) {
      if (isSyncEntry(page.data)) return page.data.structuredData;
      if (isAsyncEntry(page.data)) {
        return (await page.data.load()).structuredData;
      }
    },
    async "core:get-body"(page) {
      let body: MDXContent;

      if (isSyncEntry(page.data)) {
        body = page.data.body;
      } else if (isAsyncEntry(page.data)) {
        body = (await page.data.load()).body;
      } else return;

      return {
        node: createElement(body, {
          components: await getMdxComponents.call(this, page),
        }),
      };
    },
    async "core:render-toc"(page) {
      if (isSyncEntry(page.data)) return page.data.toc;
      if (isAsyncEntry(page.data)) return (await page.data.load()).toc;
    },
    "core:get-creation-date": getDate,
    async "core:get-modified-date"(page) {
      let data: object;

      if (isSyncEntry(page.data)) {
        data = page.data;
      } else if (isAsyncEntry(page.data)) {
        data = await page.data.load();
      } else return;

      return "lastModified" in data && data.lastModified instanceof Date
        ? data.lastModified
        : undefined;
    },
    "blog:get-tags"(page) {
      if (isSyncEntry(page.data) || isAsyncEntry(page.data)) {
        const parsed = tagsSchema.safeParse(page.data);
        return parsed.success ? parsed.data.tags : undefined;
      }
    },
    "tegami:get-date": getDate,
  } as Adapter<C>;
}

function getDate(page: AppShape["page"]) {
  if ((isSyncEntry(page.data) || isAsyncEntry(page.data)) && "date" in page.data) {
    if (page.data.date instanceof Date) return page.data.date;
    if (typeof page.data.date === "string") return new Date(page.data.date);
  }
}

const tagsSchema = z.looseObject({
  tags: z.optional(z.array(z.string())),
});

function isSyncEntry(v: object): v is DocCollectionEntry {
  return (
    "info" in v && typeof v.info === "object" && "_exports" in v && typeof v._exports === "object"
  );
}

function isAsyncEntry(v: object): v is AsyncDocCollectionEntry {
  return "info" in v && typeof v.info === "object" && "load" in v && typeof v.load === "function";
}
