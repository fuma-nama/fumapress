<script setup lang="ts">
import { computed, shallowRef } from "vue";
import { ChevronDownIcon } from "lucide-vue-next";
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from "reka-ui";
import { useTranslations } from "../../../../../core/translate";
import { cn } from "../../../../../utils/cn";
import ActiveHeading from "./ActiveHeading.vue";
import type { TOCDropdownProps } from "./index";
import TOCList from "./TOCList.vue";
import TOCProgress from "./TOCProgress.vue";

/** the TOC dropdown for page header */
// the other options (like `container` of `TOCPopoverProps`) are ignored
defineOptions({ inheritAttrs: false });

const props = defineProps<TOCDropdownProps>();
const t = useTranslations({ note: "table of contents" });
const open = shallowRef(false);
const triggerClass = computed(() =>
  cn(
    "flex items-center gap-2 min-w-0 h-8 px-1.5 -mx-1.5 rounded-lg text-start text-sm transition-colors",
    open.value
      ? "bg-fd-accent text-fd-accent-foreground"
      : "text-fd-muted-foreground hover:bg-fd-accent/60 hover:text-fd-accent-foreground",
    props.trigger?.class,
  ),
);
const chevronClass = computed(() =>
  cn("size-3.5 shrink-0 transition-transform", open.value && "rotate-180"),
);
// The class of Base UI's positioner (`z-50`) is on the content: Reka UI gives its wrapper the z-index of the content.
// Its popup transitions from `data-starting-style` to `data-ending-style`, Reka UI waits for a CSS animation before it
// unmounts the content: the start is `@starting-style`, the end an animation of the closed state.
const contentClass = computed(() =>
  cn(
    "z-50 flex flex-col w-88 max-w-(--reka-popover-content-available-width) max-h-[min(28rem,var(--reka-popover-content-available-height))] p-3 rounded-2xl border bg-fd-popover text-fd-popover-foreground shadow-xl outline-none origin-(--reka-popover-content-transform-origin) transition-[opacity,scale] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] starting:opacity-0 starting:scale-95 data-[state=closed]:animate-fd-popover-out motion-reduce:transition-none",
    props.content?.class,
  ),
);
// attributes of the element: `dir` of `HTMLAttributes` isn't the `Direction` prop of Reka UI
const contentAttrs = computed<Record<string, unknown>>(() => ({
  ...props.content,
  class: contentClass.value,
}));
</script>

<template>
  <PopoverRoot v-model:open="open">
    <PopoverTrigger v-bind="{ ...trigger, class: triggerClass }">
      <TOCProgress class="shrink-0" />
      <ActiveHeading active-class-name="text-fd-foreground">
        <template #fallback>{{ t("On this page") }}</template>
      </ActiveHeading>
      <ChevronDownIcon :class="chevronClass" />
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        align="start"
        :side-offset="8"
        position-strategy="fixed"
        v-bind="contentAttrs"
      >
        <slot name="header" />
        <TOCList :style="props.style" :list="props.list" class="py-1" @select="open = false" />
        <slot name="footer" />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
