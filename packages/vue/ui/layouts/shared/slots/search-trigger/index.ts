import type { HTMLAttributes } from "vue";
import type { ButtonProps } from "../../../../components/ui/button";

export { default as SearchTrigger } from "./SearchTrigger.vue";
export { default as FullSearchTrigger } from "./FullSearchTrigger.vue";

export interface SearchTriggerProps {
  hideIfDisabled?: boolean;
  size?: ButtonProps["size"];
  color?: ButtonProps["color"];
  variant?: ButtonProps["variant"];
  class?: HTMLAttributes["class"];
}

export interface FullSearchTriggerProps {
  hideIfDisabled?: boolean;
  class?: HTMLAttributes["class"];
}
