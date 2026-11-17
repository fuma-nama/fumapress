import type { HTMLAttributes } from "vue";
import type { LayoutTab } from "../../../shared";

export { default as TabDropdown } from "./TabDropdown.vue";

/** the attributes of a `<button>`, the slot `placeholder` is shown when no tab is active */
export interface TabDropdownProps extends /* @vue-ignore */ HTMLAttributes {
  class?: HTMLAttributes["class"];
  tabs: LayoutTab[];
}
