import type { Component } from "vue";
import type * as PageTree from "@fumapress/vue/page-tree";
import type {
  AIChatOptions,
  BaseLayoutProps,
  BaseSlots,
  GetLayoutTabsOptions,
  LayoutTab,
} from "../shared";
import type * as Drawer from "../../primitives/drawer";
import type { SidebarProviderProps, useSidebar } from "./slots/sidebar";

export { default as DocsLayout, default as GlassLayout } from "./DocsLayout.vue";
export { useGlassLayout } from "./context";

export interface DocsSlots extends BaseSlots {
  /** receives the attributes of a `<div>` */
  header: Component;
  sidebar: {
    /** receives `SidebarProps`: the attributes of an `<aside>` */
    main: Component;
    /** receives `SidebarProviderProps` */
    provider: Component;
    use: typeof useSidebar;
    /** receives `SidebarDrawerProps` */
    drawer: Component;
    drawerHandle: Drawer.Handle;
  };
}

export interface DocsLayoutProps extends BaseLayoutProps {
  tree: PageTree.Root;
  tabs?: LayoutTab[] | GetLayoutTabsOptions | false;
  aiChat?: AIChatOptions;
  slots?: Partial<DocsSlots>;
  sidebar?: SidebarProviderProps;
}

export type { DocsLayoutProps as GlassLayoutProps, DocsSlots as GlassSlots };
