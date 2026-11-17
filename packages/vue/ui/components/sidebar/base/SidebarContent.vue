<script setup lang="ts">
import { computed, shallowRef } from "vue";
import { useOnChange } from "../../../core/utils/use-on-change";
import { useSidebar } from "./context";
import type { SidebarContentState } from "./index";

/** renders its default slot on desktop only, with the state of the sidebar as slot props */
defineSlots<{ default(state: SidebarContentState): unknown }>();

const { collapsed, mode } = useSidebar();
const hover = shallowRef(false);
let element: HTMLElement | null = null;
let timer = 0;

useOnChange(collapsed, (collapsed) => {
  if (collapsed) hover.value = false;
});

function shouldIgnoreHover(e: PointerEvent): boolean {
  if (!element) return true;

  return !collapsed.value || e.pointerType === "touch" || element.getAnimations().length > 0;
}

const setElement: SidebarContentState["ref"] = (el) => {
  element = el instanceof HTMLElement ? el : null;
};

function onPointerenter(e: PointerEvent) {
  if (shouldIgnoreHover(e)) return;
  window.clearTimeout(timer);
  hover.value = true;
}

function onPointerleave(e: PointerEvent) {
  if (shouldIgnoreHover(e)) return;
  window.clearTimeout(timer);

  timer = window.setTimeout(
    () => {
      hover.value = false;
    },
    // if mouse is leaving the viewport, add a close delay
    Math.min(e.clientX, document.body.clientWidth - e.clientX) > 100 ? 0 : 500,
  );
}

const state = computed<SidebarContentState>(() => ({
  ref: setElement,
  collapsed: collapsed.value,
  hovered: hover.value,
  onPointerenter,
  onPointerleave,
}));
</script>

<template>
  <slot v-if="mode === 'full'" v-bind="state" />
</template>
