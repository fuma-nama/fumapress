<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import { cn } from "../../../../utils/cn";
import { RenderNode, type LayoutTab } from "../../../shared";

const props = defineProps<{ tab: LayoutTab; class?: HTMLAttributes["class"] }>();
const className = computed(() =>
  cn(
    "flex items-center justify-center shrink-0 size-4 font-medium",
    !props.tab.icon && "rounded bg-fd-muted text-[10px] text-fd-muted-foreground",
    props.class,
  ),
);
</script>

<template>
  <span :class="className">
    <RenderNode v-if="tab.icon != null" :node="tab.icon" />
    <template v-else-if="typeof tab.title === 'string'">{{ tab.title.charAt(0) }}</template>
  </span>
</template>
