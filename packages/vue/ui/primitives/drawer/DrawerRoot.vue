<script setup lang="ts">
import { nextTick, onMounted, provide, shallowRef, toRef, useId, watch } from "vue";
import {
  DrawerRootKey,
  runOnceAnimationsFinish,
  type DrawerRootProps,
  type DrawerStore,
  type OpenChangeReason,
  type TransitionStatus,
} from "./context";
import { acquireScrollLock } from "./scroll-lock";
import { contains, isElement } from "./swipe";

/** Groups the parts of the drawer, doesn't render an element. */
const props = withDefaults(defineProps<DrawerRootProps>(), {
  handle: undefined,
  swipeDirection: "down",
});

const open = shallowRef(false);
const mounted = shallowRef(false);
const transitionStatus = shallowRef<TransitionStatus>();
const activeTriggerId = shallowRef<string | null>(null);
const popupElement = shallowRef<HTMLElement | null>(null);
const backdropElement = shallowRef<HTMLElement | null>(null);
const internalBackdropElement = shallowRef<HTMLElement | null>(null);

function setOpen(next: boolean, _reason: OpenChangeReason, triggerId: string | null = null) {
  if (open.value === next) return;
  if (next) activeTriggerId.value = triggerId;
  open.value = next;
}

const store: DrawerStore = {
  open,
  mounted,
  transitionStatus,
  swipeDirection: toRef(props, "swipeDirection"),
  floatingId: useId(),
  titleId: shallowRef(),
  activeTriggerId,
  popupElement,
  backdropElement,
  internalBackdropElement,
  viewportElement: shallowRef(null),
  popupHeight: shallowRef(0),
  setOpen,
};
provide(DrawerRootKey, store);

// `useTransitionStatus` and `useUnmountAfterClose` of Base UI: the popup is mounted with `[data-starting-style]`
// for a frame, and stays mounted with `[data-ending-style]` until its animations finish.
let startingFrame: number | undefined;
let unmountController: AbortController | undefined;
watch(
  open,
  (value) => {
    unmountController?.abort();
    unmountController = undefined;
    if (startingFrame !== undefined) cancelAnimationFrame(startingFrame);
    startingFrame = undefined;

    if (value) {
      if (!mounted.value) {
        mounted.value = true;
        transitionStatus.value = "starting";
      }
      void nextTick(() => {
        if (!open.value) return;
        startingFrame = requestAnimationFrame(() => {
          startingFrame = undefined;
          transitionStatus.value = undefined;
        });
      });
      return;
    }

    if (!mounted.value) return;
    transitionStatus.value = "ending";
    const controller = new AbortController();
    unmountController = controller;
    void nextTick(() => {
      if (controller.signal.aborted) return;
      runOnceAnimationsFinish(
        popupElement.value,
        () => {
          unmountController = undefined;
          mounted.value = false;
          transitionStatus.value = undefined;
          activeTriggerId.value = null;
        },
        controller.signal,
      );
    });
  },
  { flush: "sync" },
);

// a press outside: on the backdrops, or on an element around the popup like the viewport
function isOutsidePressTarget(target: EventTarget | null) {
  if (!isElement(target)) return false;
  if (target === internalBackdropElement.value || target === backdropElement.value) return true;
  return contains(target, popupElement.value) && !target.hasAttribute("data-base-ui-portal");
}

onMounted(() => {
  // detached triggers read the store from the handle, on the client only
  watch(
    () => props.handle,
    (handle, _, onCleanup) => {
      if (!handle) return;
      handle.store.value = store;
      onCleanup(() => {
        if (handle.store.value === store) handle.store.value = null;
      });
    },
    { immediate: true },
  );

  // `useDismiss` and `useScrollLock` of the dialog root
  watch(
    open,
    (value, _, onCleanup) => {
      if (!value) return;
      let pressStartedOutside = false;

      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key !== "Escape" || e.isComposing) return;
        e.stopPropagation();
        setOpen(false, "escape-key");
      };
      const onPointerDown = (e: PointerEvent) => {
        pressStartedOutside = e.button === 0 && isOutsidePressTarget(e.target);
      };
      const onClick = (e: MouseEvent) => {
        if (!pressStartedOutside) return;
        pressStartedOutside = false;
        if (e.button === 0 && isOutsidePressTarget(e.target)) setOpen(false, "outside-press");
      };

      document.addEventListener("keydown", onKeyDown);
      document.addEventListener("pointerdown", onPointerDown, true);
      document.addEventListener("click", onClick, true);
      const releaseScrollLock = acquireScrollLock();
      onCleanup(() => {
        document.removeEventListener("keydown", onKeyDown);
        document.removeEventListener("pointerdown", onPointerDown, true);
        document.removeEventListener("click", onClick, true);
        releaseScrollLock();
      });
    },
    { immediate: true },
  );

  // a modal popup hides the elements outside of it from assistive technologies
  watch(
    [open, popupElement],
    ([value, popup], _, onCleanup) => {
      if (!value || !popup) return;
      const portal = popup.closest("[data-base-ui-portal]") ?? popup;
      const hidden: Element[] = [];
      for (const child of Array.from(document.body.children)) {
        if (
          child === portal ||
          child.contains(portal) ||
          child.getAttribute("aria-hidden") === "true"
        )
          continue;
        if (
          ["SCRIPT", "STYLE", "TEMPLATE"].includes(child.tagName) ||
          child.hasAttribute("aria-live")
        )
          continue;
        child.setAttribute("aria-hidden", "true");
        hidden.push(child);
      }
      onCleanup(() => {
        for (const child of hidden) child.removeAttribute("aria-hidden");
      });
    },
    { immediate: true },
  );
});
</script>

<template>
  <slot />
</template>
