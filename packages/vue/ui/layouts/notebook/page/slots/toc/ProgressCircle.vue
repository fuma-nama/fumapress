<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    value: number;
    strokeWidth?: number;
    size?: number;
    min?: number;
    max?: number;
  }>(),
  { strokeWidth: 1.5, size: 18, min: 0, max: 100 },
);

function clamp(input: number, min: number, max: number): number {
  if (input < min) return min;
  if (input > max) return max;
  return input;
}

const normalizedValue = computed(() => clamp(props.value, props.min, props.max));
const radius = computed(() => props.size / 2 - props.strokeWidth);
const circumference = computed(() => 2 * Math.PI * radius.value);
const progress = computed(() => (normalizedValue.value / props.max) * circumference.value);
const circleProps = computed(() => ({
  cx: props.size / 2,
  cy: props.size / 2,
  r: radius.value,
  fill: "none",
  "stroke-width": props.strokeWidth,
}));
</script>

<template>
  <svg
    role="progressbar"
    :viewBox="`0 0 ${size} ${size}`"
    :aria-valuenow="normalizedValue"
    :aria-valuemin="min"
    :aria-valuemax="max"
    :style="{ width: `${size}px`, height: `${size}px` }"
  >
    <circle v-bind="circleProps" class="stroke-current/25" />
    <circle
      v-bind="circleProps"
      stroke="currentColor"
      :stroke-dasharray="circumference"
      :stroke-dashoffset="circumference - progress"
      stroke-linecap="round"
      :transform="`rotate(-90 ${size / 2} ${size / 2})`"
      class="transition-all"
    />
  </svg>
</template>
