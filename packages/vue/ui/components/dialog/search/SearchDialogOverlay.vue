<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import { DialogOverlay } from "reka-ui";
import { cn } from "../../../utils/cn";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
const className = computed(() =>
  cn(
    "fixed inset-0 z-50 backdrop-blur-xs bg-fd-overlay data-[state=open]:animate-fd-fade-in data-[state=closed]:animate-fd-fade-out",
    props.class,
  ),
);
</script>

<template>
  <DialogOverlay :class="className">
    <slot />
  </DialogOverlay>
</template>
