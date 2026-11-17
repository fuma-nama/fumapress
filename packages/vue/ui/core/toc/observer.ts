import {
  computed,
  inject,
  onMounted,
  shallowRef,
  watch,
  type ComputedRef,
  type InjectionKey,
  type Ref,
} from "vue";
import type { TOCItemInfo, TOCItemType } from "./index";

export const ObserverKey: InjectionKey<ComputedRef<Observer>> = Symbol.for("fd-toc-observer");
export const ScrollKey: InjectionKey<Readonly<Ref<HTMLElement | null | undefined>>> =
  Symbol.for("fd-toc-scroll");

export function useObserver(): ComputedRef<Observer> {
  const observer = inject(ObserverKey, null);
  if (!observer) throw new Error(`Component must be used under the <AnchorProvider /> component.`);
  return observer;
}

/** subscribe to a value of the observer */
export function useObserverValue<T>(get: (observer: Observer) => T): ComputedRef<T> {
  const observer = useObserver();
  const version = shallowRef(0);

  onMounted(() => {
    watch(
      observer,
      (observer, _, onCleanup) => {
        onCleanup(observer.subscribe(() => void version.value++));
      },
      { immediate: true },
    );
  });

  return computed(() => {
    void version.value;
    return get(observer.value);
  });
}

export function getItemId(url: string) {
  if (url.startsWith("#")) return url.slice(1);
  return null;
}

type ChangeListener = (items: TOCItemInfo[]) => void;

/** a heading is in view when this ratio of it is visible */
const VISIBLE_RATIO = 0.9;

export class Observer {
  items: TOCItemInfo[];
  /** ids of active items */
  activeAnchors: string[] = [];
  /** id of the current item: the last active one while it is in view, or the first one in view */
  activeAnchor: string | undefined;
  private observer: IntersectionObserver | null = null;
  /** ids of headings in view, see `VISIBLE_RATIO` */
  private visible = new Set<string>();
  private listeners = new Set<ChangeListener>();

  constructor(
    toc: TOCItemType[],
    readonly single: boolean,
  ) {
    this.items = [];
    for (const item of toc) {
      const id = getItemId(item.url);
      if (id) this.items.push({ id, active: false, fallback: false, t: 0, original: item });
    }
  }

  listen(listener: ChangeListener) {
    this.listeners.add(listener);
  }

  unlisten(listener: ChangeListener) {
    this.listeners.delete(listener);
  }

  // arrow function: passed detached
  subscribe = (listener: ChangeListener) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  select(id: string) {
    this.activeAnchor = id;
    this.update();
  }

  watch() {
    if (this.observer) return;

    this.observer = new IntersectionObserver(this.callback.bind(this), {
      threshold: VISIBLE_RATIO,
    });
    for (const item of this.items) {
      const element = document.getElementById(item.id);
      if (!element) continue;
      this.observer.observe(element);
    }
  }

  unwatch() {
    this.observer?.disconnect();
    this.observer = null;
    this.visible.clear();
  }

  private callback(entries: IntersectionObserverEntry[]) {
    for (const entry of entries) {
      if (entry.intersectionRatio >= VISIBLE_RATIO) this.visible.add(entry.target.id);
      else this.visible.delete(entry.target.id);
    }

    if (this.activeAnchor === undefined || !this.visible.has(this.activeAnchor)) {
      this.activeAnchor =
        this.items.find((item) => this.visible.has(item.id))?.id ??
        this.findAbove(entries[0]!.rootBounds);
    }
    this.update();
  }

  /**
   * Measure the last heading above the view, when no heading is in view.
   *
   * Headings can pass the view without intersecting it, so this cannot be tracked from entries.
   */
  private findAbove(root: DOMRectReadOnly | null): string | undefined {
    if (!root) return;
    // headings are entirely above or below the visible area, which contains the viewport center
    const center = (root.top + root.bottom) / 2;
    let id: string | undefined;

    for (const item of this.items) {
      const rect = document.getElementById(item.id)?.getBoundingClientRect();
      // skip hidden headings
      if (!rect || rect.height === 0) continue;
      if (rect.top >= center) break;
      id = item.id;
    }
    return id;
  }

  private update() {
    const activeAnchors: string[] = [];
    const t = Date.now();
    this.items = this.items.map((item) => {
      const active =
        this.single || this.visible.size === 0
          ? item.id === this.activeAnchor
          : this.visible.has(item.id);
      const fallback = active && !this.visible.has(item.id);
      if (active) activeAnchors.push(item.id);
      return item.active === active && item.fallback === fallback
        ? item
        : { ...item, active, fallback, t };
    });
    this.activeAnchors = activeAnchors;
    for (const listener of this.listeners) listener(this.items);
  }
}
