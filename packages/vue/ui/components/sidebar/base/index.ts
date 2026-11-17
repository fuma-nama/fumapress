import type { ComponentPublicInstance } from "vue";

export { default as SidebarProvider } from "./SidebarProvider.vue";
export { default as SidebarContent } from "./SidebarContent.vue";
export { default as SidebarDrawerOverlay } from "./SidebarDrawerOverlay.vue";
export { default as SidebarDrawerContent } from "./SidebarDrawerContent.vue";
export { default as SidebarViewport } from "./SidebarViewport.vue";
export { default as SidebarSeparator } from "./SidebarSeparator.vue";
export { default as SidebarItem } from "./SidebarItem.vue";
export { default as SidebarFolder } from "./SidebarFolder.vue";
export { default as SidebarFolderTrigger } from "./SidebarFolderTrigger.vue";
export { default as SidebarFolderLink } from "./SidebarFolderLink.vue";
export { default as SidebarFolderContent } from "./SidebarFolderContent.vue";
export { default as SidebarTrigger } from "./SidebarTrigger.vue";
export { default as SidebarCollapseTrigger } from "./SidebarCollapseTrigger.vue";
export { useSidebar, useFolder, useFolderDepth, useAutoScroll } from "./context";

export interface SidebarProviderProps {
  /**
   * Open folders by default if their level is lower or equal to a specific level
   * (Starting from 1)
   *
   * @defaultValue 0
   */
  defaultOpenLevel?: number;

  /**
   * Prefetch links, default behaviour depends on your framework.
   */
  prefetch?: boolean;

  /**
   * Support collapsing the sidebar on desktop mode
   *
   * @defaultValue true
   */
  collapsible?: boolean;
}

/** the slot props of `SidebarContent` */
export interface SidebarContentState {
  /** bind it to the element of the sidebar: `:ref="ref"` */
  ref: (element: Element | ComponentPublicInstance | null) => void;
  collapsed: boolean;
  hovered: boolean;
  /** listeners of the element, named so that `v-bind` adds them */
  onPointerenter: (event: PointerEvent) => void;
  onPointerleave: (event: PointerEvent) => void;
}
