import {
  inject,
  onMounted,
  toValue,
  watch,
  type InjectionKey,
  type MaybeRefOrGetter,
  type Ref,
} from "vue";
import { baseSlots, type BaseSlotsProps, type LinkItemType } from "../shared";
import type { DocsSlots } from "./index";

export interface LayoutContext {
  props: Readonly<Ref<BaseSlotsProps>>;
  menuItems: Readonly<Ref<LinkItemType[]>>;
  navItems: Readonly<Ref<LinkItemType[]>>;
  slots: Readonly<Ref<DocsSlots>>;
}

export const LayoutKey: InjectionKey<LayoutContext> = Symbol("fd-flux-layout");

export function useFluxLayout() {
  const context = inject(LayoutKey, null);
  if (!context)
    throw new Error(
      "Please use Flux layout components under <DocsLayout /> (`@fumapress/vue/ui/layouts/flux`).",
    );
  return context;
}

export const { useBaseSlots } = baseSlots({
  useProps() {
    return useFluxLayout().props;
  },
});

const lockAttribute = "data-scroll-locked";
const lockedProperties = [
  "overflow",
  "overscroll-behavior",
  "margin-right",
  "--removed-body-scroll-bar-size",
] as const;
let saved: [property: string, value: string, priority: string][] = [];

function lock() {
  const body = document.body;
  const count = Number(body.getAttribute(lockAttribute) ?? "0");

  if (count === 0) {
    const gap = window.innerWidth - document.documentElement.clientWidth;
    saved = lockedProperties.map((property) => [
      property,
      body.style.getPropertyValue(property),
      body.style.getPropertyPriority(property),
    ]);
    body.style.setProperty("overflow", "hidden", "important");
    body.style.setProperty("overscroll-behavior", "contain");
    body.style.setProperty("margin-right", `${gap}px`, "important");
    body.style.setProperty("--removed-body-scroll-bar-size", `${gap}px`);
  }
  body.setAttribute(lockAttribute, String(count + 1));
}

function unlock() {
  const body = document.body;
  const count = Number(body.getAttribute(lockAttribute) ?? "1") - 1;

  if (count > 0) {
    body.setAttribute(lockAttribute, String(count));
    return;
  }
  body.removeAttribute(lockAttribute);
  for (const [property, value, priority] of saved) {
    if (value) body.style.setProperty(property, value, priority);
    else body.style.removeProperty(property);
  }
  saved = [];
}

/**
 * `<RemoveScroll />` of `react-remove-scroll`: while enabled, block the scroll of the page and remove its
 * scroll bar, `--removed-body-scroll-bar-size` on the body is the width of the removed scroll bar.
 */
export function useRemoveScroll(enabled: MaybeRefOrGetter<boolean>) {
  onMounted(() => {
    watch(
      () => toValue(enabled),
      (enabled, _, onCleanup) => {
        if (!enabled) return;
        lock();
        onCleanup(unlock);
      },
      { immediate: true },
    );
  });
}
