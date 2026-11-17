import { computed, type ComputedRef } from "vue";
import { isEqualShallow } from "../utils/is-equal";
import { useObserver, useObserverValue } from "./observer";

export { default as AnchorProvider } from "./AnchorProvider.vue";
export { default as ScrollProvider } from "./ScrollProvider.vue";
export { default as TOCItem } from "./TOCItem.vue";

export interface TOCItemType {
  title: string;
  url: string;
  depth: number;
  /** [remark-steps] the step number */
  _step?: number;
}

export type TableOfContents = TOCItemType[];

export interface TOCItemInfo {
  id: string;
  active: boolean;
  /** last time the item is updated */
  t: number;
  /** currently active but not intersecting in viewport */
  fallback: boolean;
  original: TOCItemType;
}

export interface AnchorProviderProps {
  toc: TOCItemType[];
  /**
   * Only accept one active item at most
   *
   * @defaultValue false
   */
  single?: boolean;
}

export interface ScrollProviderProps {
  /**
   * Scroll into the view of container when active: the element, like a template ref passed in a template
   */
  containerRef: HTMLElement | null | undefined;
}

export interface TOCItemProps {
  href?: string;
  autoScroll?: boolean;
}

/** @returns static info object, useful for custom rendering logic: another one when the items of the provider change */
export function useTOC() {
  const observer = useObserver();

  return computed(() => ({
    get() {
      return observer.value.items;
    },
    listen: observer.value.listen.bind(observer.value),
    unlisten: observer.value.unlisten.bind(observer.value),
  }));
}

export function useTOCSelector<T>(
  select: (items: TOCItemInfo[]) => T,
  isEqual: (a: T, b: T) => boolean = isEqualShallow,
): ComputedRef<T> {
  let prev: { value: T } | undefined;

  return useObserverValue(({ items }) => {
    const next = select(items);
    // keep the previous reference when equal, so consumers don't re-render
    const value = prev && isEqual(prev.value, next) ? prev.value : next;
    prev = { value };
    return value;
  });
}

/**
 * The current heading ID
 */
export function useActiveAnchor(): ComputedRef<string | undefined> {
  return useObserverValue((observer) => observer.activeAnchor);
}

/**
 * The id of visible anchors
 */
export function useActiveAnchors(): ComputedRef<string[]> {
  return useObserverValue((observer) => observer.activeAnchors);
}

export function useItems(): ComputedRef<TOCItemInfo[]> {
  return useObserverValue((observer) => observer.items);
}
