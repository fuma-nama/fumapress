import { inject, type InjectionKey, type Ref } from "vue";
import type { SearchResult, SearchResultTable } from "../../../core/search/client";
import type { SearchItemType } from "./index";

/** the props of the `Item` slots, `onClick` selects the item */
export interface ItemRendererProps {
  item: SearchItemType;
  table?: SearchResultTable;
  onClick: () => void;
}

export interface SearchContext {
  open: Readonly<Ref<boolean>>;
  onOpenChange: (open: boolean) => void;
  search: Readonly<Ref<string>>;
  onSearchChange: (v: string) => void;
  onSelect: (item: SearchItemType) => void;
  isLoading: Readonly<Ref<boolean>>;
  data: Readonly<Ref<SearchResult | undefined>>;
  error: Readonly<Ref<Error | undefined>>;
  /** the query to highlight */
  query: Readonly<Ref<string>>;
  /** the id of the active item, reactive */
  getActive: () => string | null;
  setActive: (id: string | null) => void;
  subscribeActive: (listener: () => void) => () => void;
}

export interface TagsListContext {
  value: Readonly<Ref<string | undefined>>;
  onValueChange: (value: string | undefined) => void;
  allowClear: Readonly<Ref<boolean>>;
}

export const RootKey: InjectionKey<SearchContext> = Symbol("fd-search-dialog");
export const TagsListKey: InjectionKey<TagsListContext> = Symbol("fd-search-tags-list");

export function useSearch(): SearchContext {
  const ctx = inject(RootKey, null);
  if (!ctx) throw new Error("Missing <SearchDialog />");
  return ctx;
}

export function useTagsList(): TagsListContext {
  const ctx = inject(TagsListKey, null);
  if (!ctx) throw new Error("Missing <TagsList />");
  return ctx;
}
