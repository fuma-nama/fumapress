<script setup lang="ts">
import { computed, shallowRef, type HTMLAttributes } from "vue";
import {
  ScrollAreaCorner,
  ScrollAreaRoot,
  ScrollAreaScrollbar,
  ScrollAreaThumb,
  ScrollAreaViewport,
} from "reka-ui";
import { cn } from "../../../utils/cn";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
// the `hovering` state of Base UI's scroll area: the scrollbar of Reka UI has no state for it
const hovering = shallowRef(false);

const className = computed(() => cn("min-h-0 flex-1", props.class));
const scrollbarClass = computed(() =>
  cn("flex h-full w-1.5 select-none transition-opacity", !hovering.value && "opacity-0"),
);

function onPointerEnterOrMove(e: PointerEvent) {
  if (e.pointerType !== "touch") hovering.value = true;
}
</script>

<template>
  <ScrollAreaRoot
    type="auto"
    :class="className"
    @pointerenter="onPointerEnterOrMove"
    @pointermove="onPointerEnterOrMove"
    @pointerleave="hovering = false"
  >
    <ScrollAreaViewport
      as-child
      class="size-full rounded-[inherit] p-4 overscroll-contain mask-[linear-gradient(to_bottom,transparent,white_12px,white_calc(100%-12px),transparent)]"
    >
      <div class="flex flex-col gap-0.5"><slot /></div>
    </ScrollAreaViewport>
    <ScrollAreaCorner />
    <ScrollAreaScrollbar :class="scrollbarClass">
      <ScrollAreaThumb class="relative flex-1 rounded-full bg-fd-border" />
    </ScrollAreaScrollbar>
  </ScrollAreaRoot>
</template>
