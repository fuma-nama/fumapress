import type { HTMLAttributes, VNode } from "vue";
import type { TabsProps as UnstyledTabsProps } from "../ui/tabs";

export { default as Tabs } from "./Tabs.vue";
export { default as TabsList } from "./TabsList.vue";
export { default as TabsTrigger } from "./TabsTrigger.vue";
export { default as Tab } from "./Tab.vue";
export { default as TabsContent } from "./TabsContent.vue";

export interface TabsProps extends Omit<UnstyledTabsProps, "value"> {
  class?: HTMLAttributes["class"];

  /**
   * Use simple mode instead of advanced usage as documented in https://radix-ui.com/primitives/docs/components/tabs.
   */
  items?: string[];

  /**
   * Shortcut for `defaultValue` when `items` is provided.
   *
   * @defaultValue 0
   */
  defaultIndex?: number;

  /**
   * Additional label in tabs list when `items` is provided, or the slot `label`.
   */
  label?: string | VNode;
}

export interface TabProps {
  /**
   * Value of tab, detect from index if unspecified.
   */
  value?: string;
}
