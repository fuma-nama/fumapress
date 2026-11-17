import type { SortedResult } from "../../index";
import type { SearchClient } from "../docs-search";
import { BASE_PATH, join } from "../../../utils/url";

export interface FetchOptions {
  /**
   * API route for search endpoint, support absolute URLs.
   *
   * @defaultValue '/api/search'
   */
  api?: string;

  /**
   * Filter results with specific tag(s).
   */
  tag?: string | string[];

  /**
   * Filter by locale
   */
  locale?: string;

  cache?: Map<string, SortedResult[]>;
}

const globalCache = new Map();

async function searchFetch(
  { api = join(BASE_PATH, "/api/search"), locale, tag, cache = globalCache }: FetchOptions,
  query: string,
): Promise<SortedResult[]> {
  const url = new URL(api, window.location.origin);
  url.searchParams.set("query", query);
  if (locale) url.searchParams.set("locale", locale);
  if (tag) url.searchParams.set("tag", Array.isArray(tag) ? tag.join(",") : tag);

  const key = url.toString();
  const cached = cache.get(key);
  if (cached) return cached;

  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
  const result = (await res.json()) as SortedResult[];
  cache.set(key, result);
  return result;
}

export function fetchClient(options: FetchOptions = {}): SearchClient {
  return {
    deps: [options.api, options.locale, String(options.tag)],
    search: (query) => searchFetch(options, query),
  };
}
