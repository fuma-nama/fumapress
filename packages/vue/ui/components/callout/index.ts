import type { HTMLAttributes, VNode } from "vue";

export { default as Callout } from "./Callout.vue";
export { default as CalloutContainer } from "./CalloutContainer.vue";
export { default as CalloutTitle } from "./CalloutTitle.vue";
export { default as CalloutDescription } from "./CalloutDescription.vue";

export type CalloutType = "info" | "warn" | "error" | "success" | "warning" | "idea";

export interface CalloutContainerProps {
  class?: HTMLAttributes["class"];

  /**
   * @defaultValue info
   */
  type?: CalloutType;

  /**
   * Force an icon, or the slot `icon`
   */
  icon?: string | VNode;
}
