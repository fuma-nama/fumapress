import type { OramaCloudOptions } from "../../../core/search/client/orama-cloud";
import type { SearchLink, SharedProps, TagItem } from "../../../contexts/search";

/**
 * Orama Cloud integration
 */
export { default } from "./OramaSearchDialog.vue";

/** the `footer` slot renders in the footer of the dialog */
export interface OramaSearchDialogProps extends SharedProps {
  links?: SearchLink[];
  client: OramaCloudOptions["client"];
  searchOptions?: OramaCloudOptions["params"];
  index?: OramaCloudOptions["index"];

  defaultTag?: string;
  tags?: TagItem[];

  /**
   * Add the "Powered by Orama" label
   *
   * @defaultValue true
   */
  showOrama?: boolean;

  /**
   * Allow to clear tag filters
   *
   * @defaultValue false
   */
  allowClear?: boolean;
}
