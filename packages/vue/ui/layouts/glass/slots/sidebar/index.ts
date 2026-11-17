import type { HTMLAttributes } from "vue";

export { drawerHandle, useSidebar } from "./context";
export { default as SidebarProvider } from "./SidebarProvider.vue";
export { default as SidebarDrawer } from "./SidebarDrawer.vue";
export { default as Sidebar } from "./Sidebar.vue";

export interface SidebarProviderProps {
  /** @default true */
  collapsible?: boolean;
}

export interface SidebarDrawerProps {
  contentProps?: HTMLAttributes;
}

/** the attributes of an `<aside>` */
export type SidebarProps = HTMLAttributes;
