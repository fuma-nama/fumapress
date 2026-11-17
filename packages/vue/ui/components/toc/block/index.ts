import type { HTMLAttributes } from "vue";

export { TOCEmpty } from "../default";
export { default as TOCItems } from "./TOCItems.vue";
export { default as TOCItem } from "./TOCItem.vue";

export interface TOCItemsProps {
  class?: HTMLAttributes["class"];
}
