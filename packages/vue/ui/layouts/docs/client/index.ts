import type { Component, Ref } from "vue";
import type { BaseSlots } from "../../shared";

export { useDocsLayout, useIsDocsLayout } from "./context";
export { default as LayoutBody } from "./LayoutBody.vue";

export interface DocsSlots extends BaseSlots {
  /** receives the attributes of a `<div>` */
  container: Component;
  /** receives the attributes of a `<header>` */
  header: Component;
  sidebar: {
    /** receives `SidebarProviderProps` */
    provider: Component;
    /** receives `SidebarProps`, and the slots `banner` and `footer` */
    root: Component;
    /** receives the attributes of a `<button>` */
    trigger: Component;
    useSidebar: () => {
      collapsed: Readonly<Ref<boolean>>;
      open: Readonly<Ref<boolean>>;
      setOpen: (v: boolean) => void;
    };
  };
}
