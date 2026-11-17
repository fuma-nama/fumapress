<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import { cn } from "../../../../utils/cn";
import { useDocsLayout } from "../..";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
const { slots } = useDocsLayout();
const { collapsed } = slots.value.sidebar?.useSidebar?.() ?? {};
const style = computed(() => ({
  gridTemplate: `"sidebar sidebar header toc toc"
"sidebar sidebar toc-popover toc toc"
"sidebar sidebar tabs toc toc"
"sidebar sidebar main toc toc" 1fr / minmax(min-content, 1fr) var(--fd-sidebar-col) minmax(0, calc(var(--fd-layout-width,97rem) - var(--fd-sidebar-width) - var(--fd-toc-width))) var(--fd-toc-width) minmax(min-content, 1fr)`,
  "--fd-docs-row-1": "var(--fd-banner-height, 0px)",
  "--fd-docs-row-2": "calc(var(--fd-docs-row-1) + var(--fd-header-height))",
  "--fd-docs-row-3": "calc(var(--fd-docs-row-2) + var(--fd-toc-popover-height))",
  "--fd-sidebar-col": collapsed?.value ? "0px" : "var(--fd-sidebar-width)",
}));
const className = computed(() =>
  cn(
    "grid overflow-x-clip min-h-(--fd-docs-height) [--fd-docs-height:100dvh] [--fd-header-height:0px] [--fd-toc-popover-height:0px] [--fd-sidebar-width:0px] [--fd-toc-width:0px] transition-[--fd-sidebar-col]",
    props.class,
  ),
);
</script>

<template>
  <div id="nd-docs-layout" :data-sidebar-collapsed="collapsed" :style="style" :class="className">
    <slot />
  </div>
</template>
