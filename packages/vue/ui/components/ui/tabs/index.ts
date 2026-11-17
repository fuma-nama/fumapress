export { TabsList } from "@fumapress/vue/reka/tabs";
export { default as Tabs } from "./Tabs.vue";
export { default as TabsTrigger } from "./TabsTrigger.vue";
export { default as TabsContent } from "./TabsContent.vue";

export interface TabsProps {
  /**
   * Identifier for Sharing value of tabs
   */
  groupId?: string;

  /**
   * Enable persistent
   */
  persist?: boolean;

  /**
   * If true, updates the URL hash based on the tab's id
   */
  updateAnchor?: boolean;

  defaultValue?: string;

  /** the selected tab, with `update:value` when it is controlled */
  value?: string;
}
