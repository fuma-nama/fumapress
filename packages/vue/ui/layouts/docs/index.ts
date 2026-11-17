import type { Component, HTMLAttributes } from "vue";
import type * as PageTree from "@fumapress/vue/page-tree";
import type { AIChatOptions, BaseLayoutProps, GetLayoutTabsOptions, LayoutTab } from "../shared";
import type { DocsSlots } from "./client";
import type { SidebarProps, SidebarProviderProps } from "./slots/sidebar";

export { default as DocsLayout } from "./DocsLayout.vue";

export interface DocsLayoutProps extends BaseLayoutProps {
  tree: PageTree.Root;
  sidebar?: SidebarOptions;
  tabMode?: "top" | "auto";
  tabs?: LayoutTab[] | GetLayoutTabsOptions | false;
  containerProps?: HTMLAttributes;
  aiChat?: AIChatOptions;
  slots?: Partial<DocsSlots>;
}

interface SidebarOptions extends SidebarProps, SidebarProviderProps {
  enabled?: boolean;
  banner?: string | Component;
  footer?: string | Component;
  /**
   * @deprecated use `slots.sidebar` instead.
   */
  component?: string | Component;
  /**
   * @deprecated use layout-level `tabMode` option instead.
   */
  tabMode?: "auto" | "top";
  /**
   * @deprecated use layout-level `tabs` option instead.
   */
  tabs?: LayoutTab[] | GetLayoutTabsOptions | false;
}

export { type DocsSlots, useDocsLayout } from "./client";
