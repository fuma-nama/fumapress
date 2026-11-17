<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import { cn } from "../../../../utils/cn";
import { useNotebookLayout } from "../../client";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
const { props: layout, slots } = useNotebookLayout();
const pageCol = "calc(var(--fd-layout-width,97rem) - var(--fd-sidebar-col) - var(--fd-toc-col))";
const { collapsed } = slots.value.sidebar?.useSidebar?.() ?? {};
const aiChatOpen = computed(() => Boolean(layout.value.aiChat?.open && layout.value.aiChat.panel));
const style = computed(() => ({
  gridTemplate:
    layout.value.nav?.mode === "top"
      ? `". header header header ."
"sidebar sidebar toc-popover toc-popover ."
"sidebar sidebar main toc ." 1fr / minmax(min-content, 1fr) var(--fd-sidebar-col) minmax(0, ${pageCol}) var(--fd-toc-col) minmax(min-content, 1fr)`
      : `"sidebar sidebar header header ."
"sidebar sidebar toc-popover toc-popover ."
"sidebar sidebar main toc ." 1fr / minmax(min-content, 1fr) var(--fd-sidebar-col) minmax(0, ${pageCol}) var(--fd-toc-col) minmax(min-content, 1fr)`,
  "--fd-docs-row-1": "var(--fd-banner-height, 0px)",
  "--fd-docs-row-2": "calc(var(--fd-docs-row-1) + var(--fd-header-height))",
  "--fd-docs-row-3": "calc(var(--fd-docs-row-2) + var(--fd-toc-popover-height))",
  "--fd-sidebar-col": collapsed?.value ? "0px" : "var(--fd-sidebar-width)",
}));
const className = computed(() =>
  cn(
    "grid overflow-x-clip min-h-(--fd-docs-height) auto-cols-auto auto-rows-auto [--fd-docs-height:100dvh] [--fd-header-height:0px] [--fd-toc-popover-height:0px] [--fd-sidebar-width:0px] [--fd-toc-width:0px] [--fd-toc-col:max(var(--fd-toc-width),var(--fd-ai-chat-col))] [transition:--fd-sidebar-col_150ms,--fd-ai-chat-col_300ms_ease-in-out]",
    aiChatOpen.value && "xl:[--fd-ai-chat-col:var(--fd-ai-chat-width)]",
    props.class,
  ),
);
</script>

<template>
  <div
    id="nd-notebook-layout"
    :data-sidebar-collapsed="collapsed"
    :style="style"
    :class="className"
  >
    <slot />
  </div>
</template>
