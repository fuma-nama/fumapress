<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import { cva } from "class-variance-authority";
import { cn } from "../../../utils/cn";
import { useTagsList } from "./context";

const itemVariants = cva(
  "rounded-md border px-2 py-0.5 text-xs font-medium text-fd-muted-foreground transition-colors",
  {
    variants: {
      active: {
        true: "bg-fd-accent text-fd-accent-foreground",
      },
    },
  },
);

const props = defineProps<{ class?: HTMLAttributes["class"]; value: string }>();
const { onValueChange, value: selectedValue, allowClear } = useTagsList();
const selected = computed(() => props.value === selectedValue.value);
const className = computed(() =>
  cn(itemVariants({ active: selected.value, className: props.class })),
);
</script>

<template>
  <button
    type="button"
    :data-active="selected"
    :class="className"
    tabindex="-1"
    @click="onValueChange(selected && allowClear ? undefined : value)"
  >
    <slot />
  </button>
</template>
