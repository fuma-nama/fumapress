import { Document, type DocumentData } from "flexsearch";
import type { AppShape, Awaitable, Context } from "@fumapress/core";

export interface PageDocument extends DocumentData {
  url: string;
  title: string;
  description: string;
  content: string;
  locale: string;
}

export interface SearchOptions<C extends AppShape = AppShape> {
  pageToIndex?: (this: Context<C>, page: C["page"]) => Awaitable<PageDocument | null>;
}

export function createSearch<C extends AppShape>(options: SearchOptions<C>, ctx: Context<C>) {
  const { getLoader } = ctx;
  const {
    pageToIndex = async function (page): Promise<PageDocument | null> {
      const txt = await this.getPageText(page);
      if (txt === undefined) return null;

      return {
        title: page.data.title ?? "",
        description: page.data.description ?? "",
        url: page.url,
        content: txt,
        locale: page.locale ?? "",
      };
    },
  } = options;
  const toIndex = (page: C["page"]) => pageToIndex.call(ctx, page);

  type ContextLoaderOutput = Awaited<ReturnType<Context<C>["getLoader"]>>;
  const searchServers = new WeakMap<ContextLoaderOutput, ReturnType<typeof createSearchServer>>();

  async function createSearchServer(source: ContextLoaderOutput) {
    const search = new Document<PageDocument>({
      document: {
        id: "url",
        index: ["title", "description", "content"],
        tag: ["locale"],
        store: true,
      },
    });

    const docs = await Promise.all(source.getPages().map(toIndex));

    for (const doc of docs) {
      if (doc) search.add(doc);
    }

    return search;
  }

  async function execute(query: string, limit: number, locale?: string | null) {
    const source = await getLoader();
    let server = searchServers.get(source);
    if (!server) {
      server = createSearchServer(source);
      searchServers.set(source, server);
    }

    return await (
      await server
    ).searchAsync(query, {
      limit,
      merge: true,
      enrich: true,
      tag: locale
        ? {
            locale,
          }
        : undefined,
    });
  }

  return { execute, pageToIndex: toIndex };
}
