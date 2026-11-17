<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, shallowRef, useTemplateRef } from "vue";
import {
  ScrollAreaRoot,
  ScrollAreaScrollbar,
  ScrollAreaThumb,
  ScrollAreaViewport,
} from "@fumapress/vue/reka/scroll-area";
import { cn } from "../../../../utils/cn";
import { useSpaciousLayout } from "../../context";
import { SidebarLinkItem, SidebarPageTree } from "./renderer";

const { menuItems } = useSpaciousLayout();
const links = computed(() => menuItems.value.filter((item) => item.type !== "icon"));
const area = useTemplateRef<HTMLDivElement>("area");
// the `hovering` state of Base UI's scroll area: the scrollbar of Reka UI has no state for it
const hovering = shallowRef(false);
const scrollbarClass = computed(() =>
  cn("flex w-1.5 py-2 select-none transition-opacity", !hovering.value && "opacity-0"),
);
const linkClass = (i: number) => cn(i === links.value.length - 1 && "mb-6");
let cleanup: (() => void) | undefined;

function onPointerEnterOrMove(e: PointerEvent) {
  if (e.pointerType !== "touch") hovering.value = true;
}

/** a soft block glides to the item under the mouse or keyboard focus */
function follow(area: HTMLDivElement | null) {
  const block = area?.firstElementChild;
  if (!area || !(block instanceof HTMLElement)) return;
  let current: Element | null = null;

  const show = (item: Element | null) => {
    if (item === current) return;
    // glide between items, appear in place when coming from outside
    block.style.transitionProperty = current ? "" : "opacity";
    current = item;
    if (!item) {
      block.style.opacity = "0";
      return;
    }

    const rect = item.getBoundingClientRect();
    const origin = area.getBoundingClientRect();
    block.style.translate = `${rect.left - origin.left}px ${rect.top - origin.top}px`;
    block.style.width = `${rect.width}px`;
    block.style.height = `${rect.height}px`;
    // the active item has its own background
    block.style.opacity = item.matches("[data-active=true]") ? "0" : "1";
  };
  const itemOf = (target: EventTarget | null) =>
    target instanceof Element ? target.closest("a[href], button") : null;

  const controller = new AbortController();
  const { signal } = controller;
  area.addEventListener(
    "pointerover",
    (e) => {
      const item = itemOf(e.target);
      // hold the position over separators and gaps
      if (item && e.pointerType === "mouse") show(item);
    },
    { signal },
  );
  area.addEventListener("pointerleave", () => show(null), { signal });
  area.addEventListener(
    "focusin",
    (e) => {
      if (e.target instanceof Element && e.target.matches(":focus-visible")) show(itemOf(e.target));
    },
    { signal },
  );
  area.addEventListener(
    "focusout",
    () => {
      if (!area.matches(":hover")) show(null);
    },
    { signal },
  );
  return () => controller.abort();
}

onMounted(() => {
  cleanup = follow(area.value);
});

onBeforeUnmount(() => cleanup?.());
</script>

<template>
  <ScrollAreaRoot
    type="auto"
    class="min-h-0 flex-1 mt-2"
    @pointerenter="onPointerEnterOrMove"
    @pointermove="onPointerEnterOrMove"
    @pointerleave="hovering = false"
  >
    <ScrollAreaViewport
      as-child
      class="size-full overscroll-contain px-3 pt-4 pb-8 mask-t-from-[calc(100%-16px)] mask-b-from-[calc(100%-32px)]"
    >
      <div ref="area" class="relative flex flex-col">
        <!-- inset to keep apart from the background of active item -->
        <div
          aria-hidden="true"
          class="absolute top-0 left-0 py-0.5 rounded-lg bg-fd-accent/60 bg-clip-content opacity-0 pointer-events-none transition-opacity duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-safe:transition-[translate,width,height,opacity]"
        />
        <SidebarLinkItem v-for="(item, i) in links" :key="i" :item="item" :class="linkClass(i)" />
        <div class="flex flex-col">
          <SidebarPageTree />
        </div>
      </div>
    </ScrollAreaViewport>
    <ScrollAreaScrollbar :class="scrollbarClass">
      <ScrollAreaThumb class="flex-1 rounded-full bg-fd-border" />
    </ScrollAreaScrollbar>
  </ScrollAreaRoot>
</template>
