import type { HTMLAttributes } from "vue";
import type { SidebarProviderProps as BaseSidebarProviderProps } from "../../../../components/sidebar/base";
import type { SidebarPageTreeComponents } from "../../../../components/sidebar/page-tree";

export { useSidebar } from "../../../../components/sidebar/base";
export { default as SidebarProvider } from "./SidebarProvider.vue";
export { default as Sidebar } from "./Sidebar.vue";
export { default as SidebarTrigger } from "./SidebarTrigger.vue";

/** the attributes of an `<aside>`, `banner` and `footer` are slots */
export interface SidebarProps extends /* @vue-ignore */ HTMLAttributes {
  components?: Partial<SidebarPageTreeComponents>;
}

export type SidebarProviderProps = Omit<BaseSidebarProviderProps, "collapsible">;
