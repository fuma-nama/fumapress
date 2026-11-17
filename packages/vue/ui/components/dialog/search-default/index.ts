import type { SearchLink, SharedProps, TagItem } from "../../../contexts/search";

export { default } from "./DefaultSearchDialog.vue";

/** the `footer` slot renders in the footer of the dialog */
export interface DefaultSearchDialogProps extends SharedProps {
  links?: SearchLink[];

  /**
   * - `fetch`: search on the server, with the endpoint at `api`.
   * - `static`: search in the browser, with the index of the data route at `api`.
   *
   * @defaultValue 'fetch'
   */
  type?: "fetch" | "static";

  defaultTag?: string;
  tags?: TagItem[];

  /**
   * Search API URL
   */
  api?: string;

  /**
   * The debounced delay for performing a search.
   */
  delayMs?: number;

  /**
   * Allow to clear tag filters
   *
   * @defaultValue false
   */
  allowClear?: boolean;
}
