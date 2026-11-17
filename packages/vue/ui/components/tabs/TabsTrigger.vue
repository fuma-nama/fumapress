<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import { cn } from "../../utils/cn";
import { TabsTrigger as UnstyledTabsTrigger } from "../ui/tabs";

const props = defineProps<{ value: string; class?: HTMLAttributes["class"] }>();
const className = computed(() =>
  cn(
    "inline-flex items-center gap-2 whitespace-nowrap text-fd-muted-foreground border-b border-transparent py-2 text-sm font-medium transition-colors [&_svg]:size-4 hover:text-fd-accent-foreground disabled:pointer-events-none disabled:opacity-50 data-[state=active]:border-fd-primary data-[state=active]:text-fd-primary",
    props.class,
  ),
);
</script>

<template>
  <UnstyledTabsTrigger :value="value" :class="className">
    <slot />
  </UnstyledTabsTrigger>
</template>
