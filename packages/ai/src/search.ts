import { Document, type DocumentData, type MergedDocumentSearchResults } from "flexsearch";
import { tool, type Tool } from "ai";
import { z } from "zod";
import type { AppContext, ConfigContext } from "fumapress";
import type { LoaderOutput } from "fumadocs-core/source";

export interface PageDocument extends DocumentData {
  url: string;
  title: string;
  description: string;
  content: string;
  locale: string;
}

type Awaitable<T> = T | Promise<T>;

export interface SearchOptions<C extends ConfigContext = ConfigContext> {
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

export function createSearch<C extends ConfigContext>(
  options: SearchOptions<C>,
  ctx: AppContext<C>,
) {
  const { getLoader } = ctx;
  const pageToIndex =
    options.pageToIndex ??
    (async function (page): Promise<PageDocument | null> {
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
    } as SearchOptions<C>["pageToIndex"]);

  type ContextLoaderOutput = LoaderOutput<C>;
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

    const docs = await chunkedAll(source.getPages().map(pageToIndex!.bind(ctx)));

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

  const searchTool = tool({
    description:
      "Search the docs content and return raw JSON results.\nIt will always return search results in the preferred locale selected by user.",
    inputSchema: z.object({
      query: z.string(),
      limit: z.number().int().min(1).max(100).default(10),
    }),
    async execute({ query, limit }, options) {
      const context = options.experimental_context as { locale: string | null };
      return execute(query, limit, context.locale);
    },
  });

  return { searchTool, execute, pageToIndex: pageToIndex!.bind(ctx) };
}

export type SearchTool = Tool<
  {
    query: string;
    limit: number;
  },
  MergedDocumentSearchResults<PageDocument>
>;
