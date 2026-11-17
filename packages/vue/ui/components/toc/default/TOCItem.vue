<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import { TOCItem as Primitive, type TOCItemProps, type TOCItemType } from "../../../core/toc";
import { cn } from "../../../utils/cn";
import { useTOCItems } from "..";
import { getItemOffset, getLineOffset } from "./utils";

const props = withDefaults(
  defineProps<TOCItemProps & { class?: HTMLAttributes["class"]; item: TOCItemType }>(),
  { autoScroll: undefined },
);
const items = useTOCItems();
const info = computed(() => {
  const index = items.value.indexOf(props.item);

  return {
    isFirst: index === 0,
    isLast: index === items.value.length - 1,
    l1: getLineOffset(props.item.depth),
    l0: getLineOffset(items.value[index - 1]?.depth ?? props.item.depth),
    l2: getLineOffset(items.value[index + 1]?.depth ?? props.item.depth),
  };
});
const className = computed(() =>
  cn(
    "prose prose-sm relative py-1.5 scroll-m-4 text-fd-muted-foreground hover:text-fd-accent-foreground transition-colors wrap-anywhere data-[active=true]:text-fd-primary",
    info.value.isFirst && "pt-0",
    info.value.isLast && "pb-0",
    props.class,
  ),
);
const svgClassName = computed(() =>
  cn(
    "absolute -top-1.5 inset-s-0 bottom-0 h-[calc(100%+--spacing(1.5))] -z-1 rtl:-scale-x-100",
    info.value.l1 !== info.value.l2 && "h-full bottom-1.5",
  ),
);
</script>

<template>
  <Primitive
    :href="href ?? item.url"
    :auto-scroll="autoScroll"
    :class="className"
    :style="{ paddingInlineStart: `${getItemOffset(item.depth)}px` }"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      :class="svgClassName"
      :style="{ width: `${Math.max(info.l0, info.l1) + 9}px` }"
    >
      <path
        v-if="info.l0 !== info.l1"
        :d="`M ${info.l0 + 0.5} 0 C ${info.l0 + 0.5} 8 ${info.l1 + 0.5} 4 ${info.l1 + 0.5} 12`"
        stroke="black"
        stroke-width="1"
        fill="none"
        class="stroke-fd-foreground/10"
      />
      <line
        :x1="info.l1 + 0.5"
        :y1="info.l0 === info.l1 ? '6' : '12'"
        :x2="info.l1 + 0.5"
        y2="100%"
        stroke-width="1"
        class="stroke-fd-foreground/10"
      />
      <g
        v-if="item._step !== undefined"
        :transform="`translate(${info.l1 + 0.5}, ${info.l1 === info.l2 ? '3' : '6'})`"
      >
        <circle cx="0" cy="50%" r="8" class="fill-fd-muted" />
        <text
          x="0"
          y="50%"
          text-anchor="middle"
          alignment-baseline="central"
          dominant-baseline="middle"
          class="fill-fd-muted-foreground font-medium text-xs leading-none font-mono rtl:-scale-x-100"
        >
          {{ item._step }}
        </text>
      </g></svg
    >{{ item.title }}
  </Primitive>
</template>
