<script setup lang="ts">
import { computed, inject, type HTMLAttributes } from "vue";
import { ChevronDown } from "../../../../../icons";
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
const showItem = computed(() => selectedIdx.value !== -1 && !open.value);
const className = computed(() =>
  cn(
    "flex w-full h-10 items-center text-sm text-fd-muted-foreground gap-2.5 px-4 py-2.5 text-start focus-visible:outline-none [&_svg]:size-4 md:px-6",
    props.class,
  ),
);
const circleClass = computed(() => cn("shrink-0", open.value && "text-fd-primary"));
const pathClass = computed(() =>
  cn(
    "truncate transition-[opacity,translate,color]",
    open.value && "text-fd-foreground",
    showItem.value && "opacity-0 -translate-y-full pointer-events-none",
  ),
);
const itemClass = computed(() =>
  cn(
    "truncate transition-[opacity,translate]",
    !showItem.value && "opacity-0 translate-y-full pointer-events-none",
  ),
);
const iconClass = computed(() =>
  cn("shrink-0 transition-transform mx-0.5", open.value && "rotate-180"),
);
</script>

<template>
  <CollapsibleTrigger :class="className" data-toc-popover-trigger="">
    <ProgressCircle
      :value="(items.findLastIndex((item) => item.active) + 1) / Math.max(1, items.length)"
      :max="1"
      :class="circleClass"
    />
    <span class="grid flex-1 *:my-auto *:row-start-1 *:col-start-1">
      <span :class="pathClass">{{ path?.name ?? t("On this page") }}</span>
      <span :class="itemClass">{{ items[selectedIdx]?.original.title }}</span>
    </span>
    <ChevronDown :class="iconClass" />
  </CollapsibleTrigger>
</template>
