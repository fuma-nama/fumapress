import { computed, toValue, type MaybeRefOrGetter } from "vue";
import type { Hit, LiteClient, SearchResponse } from "algoliasearch/lite";
import type { BaseIndex } from "../../algolia";
import type { SortedResult } from "../../index";
import { isEqualShallow } from "../../../utils/is-equal";
import type { SearchClient } from "../docs-search";
import { type UseSearchOptions, useSearch } from "../../use-search";

export interface AlgoliaOptions {
  indexName: string;
  client: LiteClient;

  /**
   * Filter results with specific tag.
   */
  tag?: string;

  locale?: string;

  onSearch?: (
    query: string,
    tag?: string,
    locale?: string,
  ) => Promise<{
    results: SearchResponse<BaseIndex>[];
  }>;
}

function groupResults(hits: Hit<BaseIndex>[]): SortedResult[] {
  const grouped: SortedResult[] = [];
  const scannedUrls = new Set<string>();

  for (const hit of hits) {
    if (!scannedUrls.has(hit.url)) {
      scannedUrls.add(hit.url);

      grouped.push({
        id: hit.url,
        type: "page",
        breadcrumbs: hit.breadcrumbs,
        url: hit.url,
        content: hit.title,
      });
    }

    grouped.push({
      id: hit.objectID,
      type: hit.content === hit.section ? "heading" : "text",
      url: hit.section_id ? `${hit.url}#${hit.section_id}` : hit.url,
      content: hit.content,
      table: hit.table,
    });
  }

  return grouped;
}

async function searchAlgolia(options: AlgoliaOptions, query: string): Promise<SortedResult[]> {
  const { indexName, onSearch, client, locale, tag } = options;
  if (query.trim().length === 0) return [];

  const result = onSearch
    ? await onSearch(query, tag, locale)
    : await client.searchForHits<BaseIndex>({
        requests: [
          {
            type: "default",
            indexName,
            query,
            distinct: 5,
            hitsPerPage: 10,
            filters: tag ? `tag:${tag}` : undefined,
          },
        ],
      });

  return groupResults(result.results[0]!.hits);
}

export function algoliaClient(options: AlgoliaOptions): SearchClient {
  return {
    deps: [options.indexName, options.client, options.locale, options.tag],
    search: (query) => searchAlgolia(options, query),
  };
}

/**
 * It searches again when `indexName`, `client`, `locale` or `tag` changes, other options are read when searching.
 */
export function useAlgoliaSearch(options: MaybeRefOrGetter<AlgoliaOptions & UseSearchOptions>) {
  const { delayMs, allowEmpty } = toValue(options);
  let prev:
    | { deps: readonly unknown[]; run: (query: string) => Promise<SortedResult[]> }
    | undefined;
  const run = computed(() => {
    const { indexName, client, locale, tag } = toValue(options);
    const deps = [indexName, client, locale, tag];
    // the search function of the last change of `deps`
    if (!prev || !isEqualShallow(prev.deps, deps)) {
      prev = {
        deps,
        run: (query) =>
          searchAlgolia({ ...toValue(options), indexName, client, locale, tag }, query),
      };
    }
    return prev.run;
  });
  return useSearch(run, { delayMs, allowEmpty });
}
