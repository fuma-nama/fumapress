<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import { cn } from "../../utils/cn";
import { TabsContent as UnstyledTabsContent } from "../ui/tabs";

const props = defineProps<{ value: string; id?: string; class?: HTMLAttributes["class"] }>();
const className = computed(() =>
  cn(
    "p-4 text-[0.9375rem] bg-fd-background rounded-xl outline-none prose-no-margin data-[state=inactive]:hidden [&>figure:only-child]:-m-4 [&>figure:only-child]:border-none",
    props.class,
  ),
);
</script>

<template>
  <UnstyledTabsContent :id="id" :value="value" :class="className">
    <slot />
  </UnstyledTabsContent>
</template>
