<script setup lang="ts">
import { computed } from "vue";
import { useTOCSelector, type TOCItemInfo } from "../../../../../core/toc";

/** the other attributes reach the `<svg>` */
const props = withDefaults(defineProps<{ size?: number }>(), { size: 16 });

// selectors to re-render only when the value changes
const selectProgress = (items: TOCItemInfo[]) =>
  (items.findLastIndex((item) => item.active) + 1) / Math.max(1, items.length);

const value = useTOCSelector(selectProgress);
const circle = computed(() => ({
  cx: props.size / 2,
  cy: props.size / 2,
  r: props.size / 2 - 1.5,
  fill: "none",
  "stroke-width": 1.5,
}));
const circumference = computed(() => 2 * Math.PI * circle.value.r);
</script>

<template>
  <svg
    role="progressbar"
    :viewBox="`0 0 ${size} ${size}`"
    :width="size"
    :height="size"
    :aria-valuenow="value"
    :aria-valuemin="0"
    :aria-valuemax="1"
  >
    <circle v-bind="circle" class="stroke-current/25" />
    <circle
      v-bind="circle"
      stroke="currentColor"
      stroke-linecap="round"
      :stroke-dasharray="circumference"
      :stroke-dashoffset="circumference * (1 - value)"
      :transform="`rotate(-90 ${circle.cx} ${circle.cy})`"
      class="transition-[stroke-dashoffset] duration-300"
    />
  </svg>
</template>
