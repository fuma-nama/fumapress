import type { HTMLAttributes } from "vue";
import type { TOCItemType } from "../../core/toc";
import type { CollapsibleProps } from "../ui/collapsible";

export { default as InlineTOC } from "./InlineTOC.vue";

export interface InlineTocProps extends /* @vue-ignore */ CollapsibleProps {
  class?: HTMLAttributes["class"];
  items: TOCItemType[];
}
