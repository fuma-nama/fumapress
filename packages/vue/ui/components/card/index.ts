import type { HTMLAttributes, VNode } from "vue";

export { default as Cards } from "./Cards.vue";
export { default as Card } from "./Card.vue";

/** `icon`, `title` and `description` are also slots of the same name */
export interface CardProps {
  class?: HTMLAttributes["class"];
  icon?: string | VNode;
  title?: string | VNode;
  description?: string | VNode;

  href?: string;
  external?: boolean;
}
