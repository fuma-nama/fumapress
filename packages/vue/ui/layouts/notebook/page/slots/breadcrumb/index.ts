import type { HTMLAttributes } from "vue";
import type { BreadcrumbOptions } from "../../../../../core/breadcrumb";

export { default as Breadcrumb } from "./Breadcrumb.vue";

/** the other attributes reach the `<div>` */
export interface BreadcrumbProps extends BreadcrumbOptions, /* @vue-ignore */ HTMLAttributes {}
