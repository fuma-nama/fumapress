<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import { cn } from "../../../utils/cn";
import { useFolderDepth } from "./context";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
const depth = useFolderDepth();
const className = computed(() =>
  cn(
    "inline-flex items-center gap-2 mb-1.5 px-2 mt-6 empty:mb-0",
    depth === 0 && "first:mt-0",
    props.class,
  ),
);
</script>

<template>
  <p :class="className">
    <slot />
  </p>
</template>
