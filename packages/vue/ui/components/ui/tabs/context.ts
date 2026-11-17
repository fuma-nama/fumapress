import { inject, type InjectionKey } from "vue";

type ChangeListener = (v: string) => void;
export const listeners = new Map<string, Set<ChangeListener>>();

export interface TabsContextType {
  valueToIdMap: Map<string, string>;
  /**
   * Tab panels, mapped by their value: each gives its element while it is in the DOM.
   *
   * Only panels that stay in the DOM (e.g. `forceMount`) have one when hidden, which is
   * what allows us to open the tab containing a hash target.
   */
  panels: Map<string, () => HTMLElement | undefined>;
  /**
   * Values of mounted triggers, unknown values from the tab group are ignored.
   */
  triggers: Set<string>;
}

export const TabsKey: InjectionKey<TabsContextType> = Symbol("fd-tabs");

export function useTabContext() {
  const ctx = inject(TabsKey, null);
  if (!ctx) throw new Error("You must wrap your component in <Tabs>");
  return ctx;
}
