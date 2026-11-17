import type { VNodeChild } from "vue";
import type { SortedResult } from "../../../core/search";
import type { SearchResult, SearchResultRecord } from "../../../core/search/client";
import type { SharedProps } from "../../../contexts/search";

export { default as SearchDialog } from "./SearchDialog.vue";
export { default as SearchDialogHeader } from "./SearchDialogHeader.vue";
export { default as SearchDialogInput } from "./SearchDialogInput.vue";
export { default as SearchDialogClose } from "./SearchDialogClose.vue";
export { default as SearchDialogFooter } from "./SearchDialogFooter.vue";
export { default as SearchDialogOverlay } from "./SearchDialogOverlay.vue";
export { default as SearchDialogContent } from "./SearchDialogContent.vue";
export { default as SearchDialogList } from "./SearchDialogList.vue";
export { default as SearchDialogListTable } from "./SearchDialogListTable.vue";
export { default as SearchDialogListItem } from "./SearchDialogListItem.vue";
export { default as SearchDialogIcon } from "./SearchDialogIcon.vue";
export { default as TagsList } from "./TagsList.vue";
export { default as TagsListItem } from "./TagsListItem.vue";
export { useSearch, useTagsList } from "./context";

export type SearchItemType =
  | ((SortedResult<VNodeChild> | SearchResultRecord) & {
      external?: boolean;
    })
  | {
      id: string;
      type: "action";
      node: VNodeChild;
      onSelect: () => void;
    };

/** @deprecated needed for backward compatibility since some previous guides referenced it */
export type { SharedProps };

/** it emits `update:open`, `update:search`, and `select` with the selected item */
export interface SearchDialogProps extends SharedProps {
  search: string;
  isLoading?: boolean;
  /** the last successful search, `<SearchDialogList />` shows its results */
  data?: SearchResult;
  /** the last search failed, `<SearchDialogList />` shows it above the results of `data` */
  error?: Error;
}

/** it emits `update:tag` */
export interface TagsListProps {
  tag?: string;
  allowClear?: boolean;
}
