import type { AlgoliaOptions } from "../../../core/search/client/algolia";
import type { SearchLink, SharedProps, TagItem } from "../../../contexts/search";

export { default } from "./AlgoliaSearchDialog.vue";

/** the `footer` slot renders in the footer of the dialog */
export interface AlgoliaSearchDialogProps extends SharedProps {
  searchOptions: AlgoliaOptions;
  links?: SearchLink[];

  defaultTag?: string;
  tags?: TagItem[];

  /**
   * Add the "Powered by Algolia" label, this is useful for free tier users
   *
   * @defaultValue false
   */
  showAlgolia?: boolean;

  /**
   * Allow to clear tag filters
   *
   * @defaultValue false
   */
  allowClear?: boolean;
}
