import { inject, onBeforeUnmount, useId, type InjectionKey, type Ref } from "vue";

type CollectionKey = string | symbol;

export interface TabsContextType {
  items: Readonly<Ref<string[] | undefined>>;
  collection: CollectionKey[];
}

export const TabsKey: InjectionKey<TabsContextType> = Symbol.for("fd-tabs-items");

export function useTabContext() {
  const ctx = inject(TabsKey, null);
  if (!ctx) throw new Error("You must wrap your component in <Tabs>");
  return ctx;
}

/**
 * Inspired by Headless UI.
 *
 * Return the index of children, this is made possible by registering the order of setup from children using the context.
 * This is supposed by work with pre-rendering & pure client-side rendering.
 */
export function useCollectionIndex() {
  const key = useId();
  const { collection } = useTabContext();

  onBeforeUnmount(() => {
    const idx = collection.indexOf(key);
    if (idx !== -1) collection.splice(idx, 1);
  });

  if (!collection.includes(key)) collection.push(key);
  return collection.indexOf(key);
}

/**
 * only escape whitespaces in values in simple mode
 */
export function escapeValue(v: string): string {
  return v.toLowerCase().replace(/\s+/g, "-");
}
