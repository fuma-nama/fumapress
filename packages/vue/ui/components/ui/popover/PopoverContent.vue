<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import { PopoverContent as Content, PopoverPortal as Portal } from "reka-ui";
import { cn } from "../../../utils/cn";

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    class?: HTMLAttributes["class"];
    align?: "start" | "center" | "end";
    sideOffset?: number;
  }>(),
  { align: "center", sideOffset: 4 },
);
const className = computed(() =>
  cn(
    "z-50 origin-(--reka-popover-content-transform-origin) overflow-y-auto max-h-(--reka-popover-content-available-height) min-w-[240px] w-(--reka-popover-trigger-width) max-w-[98vw] rounded-xl border bg-fd-popover/60 backdrop-blur-lg p-2 text-sm text-fd-popover-foreground shadow-lg focus-visible:outline-none data-[state=closed]:animate-fd-popover-out data-[state=open]:animate-fd-popover-in",
    props.class,
  ),
);
</script>

<template>
  <Portal>
    <Content
      :align="align"
      side="bottom"
      :side-offset="sideOffset"
      :class="className"
      v-bind="$attrs"
    >
      <slot />
    </Content>
  </Portal>
</template>
