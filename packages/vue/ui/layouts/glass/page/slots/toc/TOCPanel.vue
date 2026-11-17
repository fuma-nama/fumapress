<script setup lang="ts">
import { computed, type HTMLAttributes, type StyleValue } from "vue";
import { TOCItem } from "../../../../../core/toc";
import { useTOCItems } from "../../../../../components/toc";
import { cn } from "../../../../../utils/cn";
import { useContext } from "./context";

defineOptions({ inheritAttrs: false });

const props = defineProps<{ class?: HTMLAttributes["class"]; style?: StyleValue }>();
const items = useTOCItems();
const { open, inAnimation, setMobileOpen } = useContext();

const className = computed(() =>
  cn(
    "grid grid-cols-1 transition-[grid-template-rows]",
    open.value
      ? "[--row:calc(6*var(--spacing))]"
      : "[--row:calc(3*var(--spacing))] xl:[@media(hover:none)]:[--row:calc(6*var(--spacing))]",
    (!open.value || inAnimation.value) &&
      "pointer-events-none xl:[@media(hover:none)]:pointer-events-auto",
    props.class,
  ),
);
const style = computed<StyleValue>(() => [
  props.style,
  { gridTemplateRows: `repeat(${items.value.length}, var(--row))` },
]);
const barClass = computed(() =>
  cn(
    "shrink-0 bg-fd-muted-foreground/50 rounded-full size-1 transition-[background-color,width,height] group-data-[active=true]:bg-fd-primary",
    open.value
      ? "w-(--width) h-px"
      : "transition-[width,height] duration-300 xl:[@media(hover:none)]:w-(--width) xl:[@media(hover:none)]:h-px",
  ),
);
const barStyle = (depth: number) => ({
  "--width": `calc(pow(${depth}, 1.5) * var(--spacing))`,
});
const titleClass = computed(() =>
  cn(
    "truncate transition-opacity opacity-0",
    open.value ? "opacity-100" : "xl:[@media(hover:none)]:opacity-100",
  ),
);
</script>

<template>
  <div :class="className" :style="style" v-bind="$attrs">
    <TOCItem
      v-for="item in items"
      :key="item.url"
      :href="item.url"
      class="group prose prose-xs flex items-center gap-2 text-fd-muted-foreground transition-colors data-[active=true]:text-fd-primary data-[active=false]:hover:text-fd-accent-foreground xl:flex-row-reverse"
      :auto-scroll="open && !inAnimation"
      @click="setMobileOpen(false)"
    >
      <div :class="barClass" :style="barStyle(item.depth)" />
      <span :class="titleClass">{{ item.title }}</span>
    </TOCItem>
  </div>
</template>
