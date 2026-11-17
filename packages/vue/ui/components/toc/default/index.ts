import type { HTMLAttributes } from "vue";

export { default as TOCItems } from "./TOCItems.vue";
export { default as TOCEmpty } from "./TOCEmpty.vue";
export { default as TOCItem } from "./TOCItem.vue";

export interface TOCItemsProps {
  class?: HTMLAttributes["class"];
  thumbBox?: boolean;
}
