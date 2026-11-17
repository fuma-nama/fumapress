import type { Component, HTMLAttributes, Ref } from "vue";
import type * as PageTree from "@fumapress/vue/page-tree";
import type { BaseLayoutProps, BaseSlots, GetLayoutTabsOptions, LayoutTab } from "../shared";
import type { SidebarProps, SidebarProviderProps } from "./slots/sidebar";

export { useFluxLayout } from "./context";
export { default as DocsLayout } from "./DocsLayout.vue";
export { default as NavigationPanel } from "./NavigationPanel.vue";
export { default as NavigationPanelOverlay } from "./NavigationPanelOverlay.vue";

export interface DocsSlots extends BaseSlots {
  /** receives the attributes of a `<div>` */
  container: Component;
  /** receives `TabDropdownProps` */
  tabDropdown: Component;
  sidebar: {
    /** receives `SidebarProviderProps` */
    provider: Component;
    /** receives the attributes of a `<button>` */
    trigger: Component;
    /** receives `SidebarProps`, and the slots `banner` and `footer` */
    root: Component;
    useSidebar: () => {
      collapsed: Readonly<Ref<boolean>>;
      open: Readonly<Ref<boolean>>;
      setOpen: (v: boolean) => void;
    };
  };
}

/**
 * The slot `renderNavigationPanel` replaces the navigation panel, it receives `NavigationPanelProps`.
 */
export interface DocsLayoutProps extends BaseLayoutProps {
  tree: PageTree.Root;
  sidebar?: SidebarOptions;
  tabs?: LayoutTab[] | GetLayoutTabsOptions | false;
  slots?: Partial<DocsSlots>;

  containerProps?: HTMLAttributes;
}

interface SidebarOptions extends SidebarProps, SidebarProviderProps {
  enabled?: boolean;
  banner?: string | Component;
  footer?: string | Component;
  /**
   * @deprecated use layout-level `tabs` instead.
   */
  tabs?: LayoutTab[] | GetLayoutTabsOptions | false;
}

/**
 * The slot props of `renderNavigationPanel`: the parts of the navigation panel, as components
 */
export interface NavigationPanelProps {
  head: Component;
  tabDropdown: Component;
  tool: Component;
  link: Component;
}
