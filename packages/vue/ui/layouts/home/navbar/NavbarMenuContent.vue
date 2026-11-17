<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import { NavigationMenuContent } from "reka-ui";
import { cn } from "../../../utils/cn";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
// the contents share the viewport, which takes the height of the open one
const className = computed(() =>
  cn(
    "absolute inset-x-0 top-0 p-3",
    "transition-[opacity,transform,translate] duration-(--duration) ease-(--easing)",
    "data-[motion=from-end]:animate-fd-enterFromRight data-[motion=from-start]:animate-fd-enterFromLeft",
    "data-[motion=to-end]:animate-fd-exitToRight data-[motion=to-start]:animate-fd-exitToLeft",
    "grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3",
    props.class,
  ),
);
</script>

<template>
  <NavigationMenuContent :class="className">
    <slot />
  </NavigationMenuContent>
</template>
