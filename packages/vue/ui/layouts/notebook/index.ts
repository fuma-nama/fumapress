import type { HTMLAttributes } from "vue";
import type * as PageTree from "@fumapress/vue/page-tree";
import type {
  AIChatOptions,
  BaseLayoutProps,
  GetLayoutTabsOptions,
  LayoutTab,
  NavOptions,
} from "../shared";
import type { DocsSlots } from "./client";
import type { SidebarProps, SidebarProviderProps } from "./slots/sidebar";

export { default as DocsLayout } from "./DocsLayout.vue";

export interface DocsLayoutProps extends Omit<BaseLayoutProps, "nav"> {
  tree: PageTree.Root;
  tabs?: LayoutTab[] | GetLayoutTabsOptions | false;
  tabMode?: "sidebar" | "navbar";
  sidebar?: SidebarOptions;
  nav?: NavOptions & { mode?: "top" | "auto" };
  containerProps?: HTMLAttributes;
  aiChat?: AIChatOptions;
  slots?: Partial<DocsSlots>;
}

interface SidebarOptions extends SidebarProps, SidebarProviderProps {
  /**
   * @deprecated use layout-level `tabs` option instead.
   */
  tabs?: LayoutTab[] | GetLayoutTabsOptions | false;
}

export { useNotebookLayout, type DocsSlots } from "./client";
