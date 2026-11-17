import type { InjectionKey, Ref } from "vue";

export interface TabsContextType {
  containerRef: Readonly<Ref<HTMLElement | null>>;
  nested: boolean;
}

export const TabsKey: InjectionKey<TabsContextType> = Symbol("fd-codeblock-tabs");
