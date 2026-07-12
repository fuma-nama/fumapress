import { Document, type DocumentData } from "flexsearch";
import type { AppContext, AppShape } from "fumapress";

export interface PageDocument extends DocumentData {
  url: string;
  title: string;
  description: string;
  content: string;
  locale: string;
}

type Awaitable<T> = T | Promise<T>;

export interface SearchOptions<C extends AppShape = AppShape> {
  pageToIndex?: (this: AppContext<C>, page: C["page"]) => Awaitable<PageDocument | null>;
}

async function chunkedAll<O>(promises: Awaitable<O>[]): Promise<O[]> {
  const SIZE = 100;
  const out: O[] = [];
  for (let i = 0; i < promises.length; i += SIZE) {
    out.push(...(await Promise.all(promises.slice(i, i + SIZE))));
  }
  return out;
}

export function createSearch<C extends AppShape>(options: SearchOptions<C>, ctx: AppContext<C>) {
  const { getLoader } = ctx;
  const {
    pageToIndex = async function (page): Promise<PageDocument | null> {
      for (const adapter of this.adapters) {
        const txt = await adapter["core:get-text"]?.call(this, page);

        if (txt !== undefined) {
          return {
            title: page.data.title ?? "",
            description: page.data.description ?? "",
            url: page.url,
            content: txt,
            locale: page.locale ?? "",
          };
        }
      }

      return null;
    },
  } = options;

  type ContextLoaderOutput = Awaited<ReturnType<AppContext<C>["getLoader"]>>;
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

    const docs = await chunkedAll(source.getPages().map(pageToIndex.bind(ctx)));

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

  return { execute, pageToIndex: pageToIndex.bind(ctx) };
}
