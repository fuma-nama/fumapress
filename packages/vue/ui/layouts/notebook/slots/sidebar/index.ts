import type { Component, HTMLAttributes } from "vue";
import type * as Base from "../../../../components/sidebar/base";
import type { SidebarPageTreeComponents } from "../../../../components/sidebar/page-tree";

export { SidebarTabsDropdown } from "../../../../components/sidebar/tabs/dropdown";
export { useSidebar } from "../../../../components/sidebar/base";
export { default as SidebarProvider } from "./SidebarProvider.vue";
export { default as SidebarTrigger } from "./SidebarTrigger.vue";
export { default as SidebarCollapseTrigger } from "./SidebarCollapseTrigger.vue";
export { default as Sidebar } from "./Sidebar.vue";

/** the other attributes reach the `<aside>` */
export interface SidebarProps extends /* @vue-ignore */ HTMLAttributes {
  components?: Partial<SidebarPageTreeComponents>;
  /**
   * A text or a component added to the header of the sidebar. A functional component replaces the header: it
   * receives the attributes of a `<div>`, and the content of the header as the default slot.
   */
  banner?: string | Component;
  /**
   * A text or a component added to the footer of the sidebar. A functional component replaces the footer: it
   * receives the attributes of a `<div>`, and the content of the footer as the default slot.
   */
  footer?: string | Component;
  /**
   * Support collapsing the sidebar on desktop mode
   *
   * @defaultValue true
   */
  collapsible?: boolean;
}

export type SidebarProviderProps = Base.SidebarProviderProps;
