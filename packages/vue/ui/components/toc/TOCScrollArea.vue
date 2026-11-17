<script setup lang="ts">
import { computed, useTemplateRef, type HTMLAttributes } from "vue";
import { ScrollProvider } from "../../core/toc";
import { cn } from "../../utils/cn";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
const viewRef = useTemplateRef<HTMLDivElement>("view");
const className = computed(() =>
  cn(
    "relative min-h-0 text-sm overflow-x-clip overflow-y-auto overscroll-contain [scrollbar-width:none] mask-[linear-gradient(to_bottom,transparent,white_16px,white_calc(100%-16px),transparent)] py-3",
    props.class,
  ),
);
</script>

<template>
  <div ref="view" :class="className">
    <ScrollProvider :container-ref="viewRef">
      <slot />
    </ScrollProvider>
  </div>
</template>
