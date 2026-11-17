import type { HTMLAttributes } from "vue";
import type { BreadcrumbOptions } from "../../../../../core/breadcrumb";

export { default as Breadcrumb } from "./Breadcrumb.vue";

export interface BreadcrumbProps extends /* @vue-ignore */ HTMLAttributes, BreadcrumbOptions {
  class?: HTMLAttributes["class"];
}
