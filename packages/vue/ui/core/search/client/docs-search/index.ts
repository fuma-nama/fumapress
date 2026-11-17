import { computed, toValue, type MaybeRefOrGetter } from "vue";
import type { SortedResult } from "../../index";
import { isEqualShallow } from "../../../utils/is-equal";
import { type SearchResultRecord, type UseSearchOptions, useSearch } from "../../use-search";
import type { FetchOptions } from "../fetch";

type Awaitable<T> = T | Promise<T>;

export interface SearchClient {
  search: (query: string) => Awaitable<SortedResult[]>;
  deps?: readonly unknown[];
}

export type ClientPreset = ({ type: "fetch" } & FetchOptions) | { client: SearchClient };

type PresetOptions = Extract<ClientPreset, { type: string }>;

/**
 * Provide a hook to query different official search clients.
 *
 * Note: it will re-query when its parameters changed, make sure to define `deps` array if you encounter rendering issues.
 *
 * @deprecated Use the search hook of your provider instead, or `experimental_useSearch()` for other clients.
 */
export function useDocsSearch(
  options: MaybeRefOrGetter<ClientPreset & UseSearchOptions>,
  customDeps?: MaybeRefOrGetter<readonly unknown[]>,
) {
  const { delayMs, allowEmpty } = toValue(options);
  let prev:
    | { deps: readonly unknown[]; run: (query: string) => Awaitable<SortedResult[]> }
    | undefined;
  const run = computed(() => {
    const current = toValue(options);
    const client = "type" in current ? createPresetClient(current) : current.client;
    const deps = toValue(customDeps) ?? client.deps ?? [];
    // the client of the last change of `deps`
    if (!prev || !isEqualShallow(prev.deps, deps)) {
      prev = { deps, run: (query) => client.search(query) };
    }
    return prev.run;
  });
  const output = useSearch(run, { delayMs, allowEmpty });
  const data = computed(() => {
    if (!output.data.value) return "empty" as const;
    const out: SearchResultRecord[] = [];
    for (const item of output.data.value.items) {
      if (item.type === "table") out.push(...item.rows);
      else out.push(item);
    }

    return out;
  });

  return {
    ...output,
    setSearch: output.onSearchChange,
    query: { isLoading: output.isLoading, data, error: output.error },
  };
}

function createPresetClient(options: PresetOptions): SearchClient {
  const client = loadPreset(options);

  return {
    // `JSON.stringify` can still offer near-accurate results in this case
    deps: [JSON.stringify(options)],
    search: async (query) => (await client).search(query),
  };
}

function loadPreset(options: PresetOptions): Promise<SearchClient> {
  switch (options.type) {
    case "fetch":
      return import("../fetch").then((mod) => mod.fetchClient(options));
    default:
      throw new Error("unknown search client");
  }
}
