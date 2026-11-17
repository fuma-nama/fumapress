import {
  computed,
  onMounted,
  ref,
  shallowRef,
  toValue,
  unref,
  watch,
  type ComponentPublicInstance,
  type ComputedRef,
  type MaybeRef,
  type MaybeRefOrGetter,
  type Ref,
} from "vue";
import type { Root } from "hast";
import type { SortedResult } from "../index";
import { buildRegexFromQuery } from "../highlight";

type Awaitable<T> = T | Promise<T>;

export interface UseSearchOptions {
  /**
   * The debounced delay for performing a search (in ms).
   *
   * @defaultValue 100
   */
  delayMs?: number;

  /**
   * still perform search even if query is empty.
   *
   * @defaultValue false
   */
  allowEmpty?: boolean;
}

export interface SearchResultRecord extends SortedResult {
  /** `content` parsed */
  hastContent: Root;
}

export interface SearchResultTable {
  type: "table";
  /** the id of its first row */
  id: string;
  columns: number;
  /** tables like the props of type tables have no header */
  header?: Root;
  rows: SearchResultRecord[];
}

export type SearchResultItem = SearchResultRecord | SearchResultTable;

export interface SearchResult {
  /** the query searched for */
  query: string;
  items: SearchResultItem[];
}

export interface UseSearchReturn {
  search: Ref<string>;
  onSearchChange: (search: string) => void;
  /** a search for `search` is pending */
  isLoading: ComputedRef<boolean>;
  /** the last successful search, `undefined` when nothing is searched */
  data: ComputedRef<SearchResult | undefined>;
  /** the last search failed, `data` stays from the search before */
  error: ComputedRef<Error | undefined>;
}

type Run = (query: string) => Awaitable<SortedResult[]>;

interface State {
  /** the query of the last completed search */
  query: string;
  run?: unknown;
  data?: SearchResult;
  error?: Error;
}

const idle: State = { query: "" };

/**
 * The base of search hooks, for search engines without one.
 *
 * @param run - search function, search again when changed
 */
export function useSearch(
  run: MaybeRef<Run>,
  { delayMs = 100, allowEmpty = false }: UseSearchOptions = {},
): UseSearchReturn {
  const search = ref("");
  const state = shallowRef(idle);
  const empty = computed(() => search.value.length === 0 && !allowEmpty);

  onMounted(() => {
    watch(
      [search, empty, () => unref(run)] as const,
      ([search, empty, run], _, onCleanup) => {
        if (empty) {
          state.value = idle;
          return;
        }

        let active = true;
        const timer = setTimeout(async () => {
          try {
            const [results, { parseResults }] = await Promise.all([
              run(search),
              import("../parse"),
            ]);
            if (active)
              state.value = {
                query: search,
                run,
                data: { query: search, items: parseResults(results) },
              };
          } catch (error) {
            if (active) state.value = { ...state.value, query: search, run, error: error as Error };
          }
        }, delayMs);

        onCleanup(() => {
          active = false;
          clearTimeout(timer);
        });
      },
      { immediate: true },
    );
  });

  return {
    search,
    onSearchChange: (value) => {
      search.value = value;
    },
    isLoading: computed(
      () => !empty.value && (state.value.query !== search.value || state.value.run !== unref(run)),
    ),
    data: computed(() => state.value.data),
    error: computed(() => state.value.error),
  };
}

/**
 * Highlight matches of `query` in the text of an element with the CSS Custom Highlight API, style them with `::highlight(fd-search)`.
 *
 * Text in elements with `data-highlight-ignore` is skipped. The highlights stay when the element is moved, but not when its text changes, give it a new `key` in that case.
 *
 * @returns a function ref for the element
 */
export function useHighlightQuery(query: MaybeRefOrGetter<string>) {
  const target = shallowRef<Element | null>(null);

  watch(
    [target, () => toValue(query)] as const,
    ([element, query], _, onCleanup) => {
      const regex = buildRegexFromQuery(query);
      if (!element || !regex || typeof Highlight === "undefined") return;

      let highlight = CSS.highlights.get("fd-search");
      if (!highlight) CSS.highlights.set("fd-search", (highlight = new Highlight()));

      const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
        (node) => {
          if (!(node instanceof Element)) return NodeFilter.FILTER_ACCEPT;
          return node.hasAttribute("data-highlight-ignore")
            ? NodeFilter.FILTER_REJECT
            : NodeFilter.FILTER_SKIP;
        },
      );
      const ranges: StaticRange[] = [];
      while (walker.nextNode()) {
        const node = walker.currentNode as Text;
        for (const match of node.data.matchAll(regex)) {
          const range = new StaticRange({
            startContainer: node,
            startOffset: match.index,
            endContainer: node,
            endOffset: match.index + match[0].length,
          });
          highlight.add(range);
          ranges.push(range);
        }
      }

      onCleanup(() => {
        for (const range of ranges) highlight.delete(range);
      });
    },
    { flush: "post" },
  );

  return (element: Element | ComponentPublicInstance | null) => {
    target.value = element instanceof Element ? element : null;
  };
}
