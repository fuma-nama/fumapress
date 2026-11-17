<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import { AccordionTrigger as Trigger } from "reka-ui";
import { ChevronRight } from "lucide-vue-next";
import { cn } from "../../../utils/cn";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
const className = computed(() =>
  cn(
    "group flex flex-1 items-center gap-2 px-3 py-2.5 text-start focus-visible:outline-none",
    props.class,
  ),
);
</script>

<template>
  <Trigger :class="className">
    <ChevronRight
      class="size-4 shrink-0 text-fd-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-90"
    />
    <slot />
  </Trigger>
</template>
