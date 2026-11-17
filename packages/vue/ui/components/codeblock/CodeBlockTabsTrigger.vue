<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import { cn } from "../../utils/cn";
import { TabsTrigger } from "../ui/tabs";

const props = defineProps<{ value: string; class?: HTMLAttributes["class"] }>();
const className = computed(() =>
  cn(
    "relative group inline-flex text-sm font-medium text-nowrap items-center transition-colors gap-2 px-2 py-1.5 hover:text-fd-accent-foreground data-[state=active]:text-fd-primary [&_svg]:size-3.5",
    props.class,
  ),
);
</script>

<template>
  <TabsTrigger :value="value" :class="className">
    <div class="absolute inset-x-2 bottom-0 h-px group-data-[state=active]:bg-fd-primary" />
    <slot />
  </TabsTrigger>
</template>
