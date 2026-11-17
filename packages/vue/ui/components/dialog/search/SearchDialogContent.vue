<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import { DialogContent, DialogPortal, DialogTitle } from "reka-ui";
import { useTranslations } from "../../../core/translate";
import { cn } from "../../../utils/cn";

defineOptions({ inheritAttrs: false });

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
const t = useTranslations({ note: "search dialog" });
const className = computed(() =>
  cn(
    "fixed left-1/2 top-4 md:top-[calc(50%-250px)] z-50 w-[calc(100%-1rem)] max-w-screen-sm -translate-x-1/2 rounded-xl border bg-fd-popover text-fd-popover-foreground shadow-2xl overflow-hidden data-[state=closed]:animate-fd-dialog-out data-[state=open]:animate-fd-dialog-in focus-visible:outline-none",
    "*:border-b *:has-[+:last-child[data-empty=true]]:border-b-0 *:data-[empty=true]:border-b-0 *:last:border-b-0",
    props.class,
  ),
);

// the event of Reka UI has no interaction type: the input is focused without scrolling for touch too
function onOpenAutoFocus(e: Event) {
  const input = (e.target as HTMLElement).querySelector<HTMLInputElement>(
    "input[data-fd-search-dialog-input]",
  );
  if (!input) return;

  input.focus({ preventScroll: true });
  e.preventDefault();
}
</script>

<template>
  <DialogPortal>
    <DialogContent
      id="fd-search-dialog-content"
      :aria-describedby="undefined"
      :class="className"
      v-bind="$attrs"
      @open-auto-focus="onOpenAutoFocus"
    >
      <DialogTitle class="hidden">{{ t("Search") }}</DialogTitle>
      <slot />
    </DialogContent>
  </DialogPortal>
</template>
