import type { HTMLAttributes } from "vue";
import type * as PageTree from "@fumapress/vue/page-tree";

export { default as Footer } from "./Footer.vue";

type Item = Pick<PageTree.Item, "name" | "description" | "url">;

/** the other attributes reach the `<div>`, the default slot is after it */
export interface FooterProps extends /* @vue-ignore */ HTMLAttributes {
  class?: HTMLAttributes["class"];
  /**
   * Items including information for the next and previous page
   */
  items?: {
    previous?: Item;
    next?: Item;
  };
}
