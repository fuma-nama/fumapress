import type { HTMLAttributes } from "vue";
import type { SidebarProviderProps as BaseSidebarProviderProps } from "../../../../components/sidebar/base";

export { default as SidebarProvider } from "./SidebarProvider.vue";
export { default as Sidebar } from "./Sidebar.vue";
export { default as SidebarDrawer } from "./SidebarDrawer.vue";

// a named import: the compiler of Vue doesn't resolve a type through a namespace
export type SidebarProviderProps = Omit<BaseSidebarProviderProps, "collapsible">;
/** the attributes of an `<aside>` */
export interface SidebarProps extends /* @vue-ignore */ HTMLAttributes {}
