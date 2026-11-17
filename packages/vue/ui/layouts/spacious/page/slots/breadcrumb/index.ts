import type { HTMLAttributes } from "vue";
import type { BreadcrumbOptions } from "../../../../../core/breadcrumb";

export { default as Breadcrumb } from "./Breadcrumb.vue";
export { useBreadcrumbItems } from "./utils";

/** the other attributes reach the `<nav>` */
export interface BreadcrumbProps extends BreadcrumbOptions, /* @vue-ignore */ HTMLAttributes {
  class?: HTMLAttributes["class"];
}
