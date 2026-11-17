import { searchIndex, type Load, type SearchEntry } from "@fumapress/vue/client";
import type { SearchClient } from "../docs-search";

/**
 * Searches the index of the site in the browser: `load` reads the data route at `from` on the first search. It
 * stands in for the static clients of Fumadocs (Orama, FlexSearch), without a dependency.
 */
export function staticClient(load: Load, from: string): SearchClient {
  return {
    search: async (query) => searchIndex((await load<SearchEntry[]>(from)) ?? [], query),
    deps: [from],
  };
}
