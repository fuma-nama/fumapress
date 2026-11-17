import type { Component } from "vue";
import type * as PageTree from "@fumapress/vue/page-tree";
import type {
  AIChatOptions,
  BaseLayoutProps,
  BaseSlots,
  GetLayoutTabsOptions,
  LayoutTab,
} from "../shared";
import type { SidebarProviderProps } from "./slots/sidebar";

export { default as DocsLayout } from "./DocsLayout.vue";
export { useSpaciousLayout } from "./context";

export interface DocsSlots extends BaseSlots {
  /** receives the attributes of a `<header>` */
  header: Component;
  /**
   * The actions at the top right of page panel: receives the attributes of a `<div>`
   */
  actions: Component;
  sidebar: {
    /** receives `SidebarProviderProps` */
    provider: Component;
    /** receives `SidebarProps` */
    main: Component;
    drawer: Component;
  };
}

/** the page is the default slot */
export interface DocsLayoutProps extends BaseLayoutProps {
  tree: PageTree.Root;
  tabs?: LayoutTab[] | GetLayoutTabsOptions | false;
  aiChat?: AIChatOptions;
  sidebar?: SidebarProviderProps;
  slots?: Partial<DocsSlots>;
}
