<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import { TOCItem as Primitive, type TOCItemProps, type TOCItemType } from "../../../core/toc";
import { cn } from "../../../utils/cn";

const props = withDefaults(
  defineProps<TOCItemProps & { class?: HTMLAttributes["class"]; item: TOCItemType }>(),
  { autoScroll: undefined },
);
const className = computed(() =>
  cn(
    "group prose relative py-1 pe-2 text-[0.8125rem]/5 scroll-m-4 text-fd-muted-foreground hover:text-fd-accent-foreground transition-colors wrap-anywhere data-[active=true]:text-fd-primary",
    props.class,
  ),
);

function getItemOffset(depth: number): number {
  if (depth <= 2) return 8;
  if (depth === 3) return 20;
  return 32;
}
</script>

<template>
  <Primitive
    :href="href ?? item.url"
    :auto-scroll="autoScroll"
    :class="className"
    :style="{ paddingInlineStart: `${getItemOffset(item.depth)}px` }"
  >
    <span
      v-if="item._step !== undefined"
      class="inline-flex size-4 me-1.5 items-center justify-center rounded-full align-text-bottom bg-fd-muted text-fd-muted-foreground font-mono font-medium text-[10px] transition-colors group-data-[active=true]:bg-fd-primary group-data-[active=true]:text-fd-primary-foreground"
      >{{ item._step }}</span
    >{{ item.title }}
  </Primitive>
</template>
