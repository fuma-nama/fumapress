<script setup lang="ts">
import { computed, inject, type HTMLAttributes } from "vue";
import { ChevronDown } from "lucide-vue-next";
import { AnimatePresence, motion } from "motion-v";
import * as Base from "../../../../../components/toc";
import { CollapsibleTrigger } from "../../../../../components/ui/collapsible";
import { useTreePath } from "../../../../../contexts/tree";
import { useTranslations } from "../../../../../core/translate";
import { cn } from "../../../../../utils/cn";
import { TocPopoverKey } from "./context";
import ProgressCircle from "./ProgressCircle.vue";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
const t = useTranslations({ note: "table of contents" });
const { open } = inject(TocPopoverKey)!;
const items = Base.useItems();
const selectedIdx = computed(() => items.value.findIndex((item) => item.active));
const treePath = useTreePath();
const path = computed(() => treePath.value.at(-1));
const pathKey = computed(() => path.value?.$id ?? ":pathId");
const spanProps = computed(() => ({
  transition: {
    duration: 0.1,
  },
  initial: {
    opacity: 0,
    y: 10,
  },
  animate: {
    opacity: 1,
    y: 0,
  },
  exit: {
    opacity: 0,
    y: -10,
  },
  class: cn(open.value && "text-fd-popover-foreground"),
}));

const className = computed(() =>
  cn(
    "flex w-full h-8.5 items-center text-sm text-fd-muted-foreground gap-2.5 px-2 text-start focus-visible:outline-none [&_svg]:size-4",
    props.class,
  ),
);
const circleClass = computed(() => cn("shrink-0", open.value && "text-fd-primary"));
const chevronClass = computed(() =>
  cn("ms-auto shrink-0 transition-transform", open.value && "rotate-180"),
);
</script>

<template>
  <CollapsibleTrigger :class="className" data-toc-popover-trigger="">
    <ProgressCircle
      :value="(items.findLastIndex((item) => item.active) + 1) / Math.max(1, items.length)"
      :max="1"
      :class="circleClass"
    />
    <AnimatePresence mode="wait">
      <motion.span v-if="items[selectedIdx] && !open" :key="selectedIdx" v-bind="spanProps">
        {{ items[selectedIdx]?.original.title }}
      </motion.span>
      <motion.span v-else-if="path" :key="pathKey" v-bind="spanProps">
        {{ path.name }}
      </motion.span>
      <motion.span v-else key=":toc" v-bind="spanProps">
        {{ t("On this page") }}
      </motion.span>
    </AnimatePresence>

    <ChevronDown :class="chevronClass" />
  </CollapsibleTrigger>
</template>
