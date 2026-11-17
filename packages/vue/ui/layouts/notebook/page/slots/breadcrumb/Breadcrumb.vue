<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import { ChevronRight } from "../../../../../icons";
import { useTreeContext, useTreePath } from "../../../../../contexts/tree";
import { getBreadcrumbItemsFromPath } from "../../../../../core/breadcrumb";
import { Link } from "../../../../../core/link";
import { cn } from "../../../../../utils/cn";
import type { BreadcrumbProps } from "./index";

const props = withDefaults(
  defineProps<BreadcrumbProps & { class?: HTMLAttributes["class"] }>(),
  // a boolean prop is `false` without a default
  { includeRoot: undefined, includeSeparator: undefined, includePage: undefined },
);
const path = useTreePath();
const { root } = useTreeContext();
const items = computed(() => {
  return getBreadcrumbItemsFromPath(root.value, path.value, {
    includePage: props.includePage,
    includeSeparator: props.includeSeparator,
    includeRoot: props.includeRoot,
  });
});
const className = computed(() =>
  cn("flex items-center gap-1.5 text-sm text-fd-muted-foreground", props.class),
);

function itemClass(i: number) {
  return cn("truncate", i === items.value.length - 1 && "text-fd-primary font-medium");
}

function linkClass(i: number) {
  return cn(itemClass(i), "transition-opacity hover:opacity-80");
}
</script>

<template>
  <div v-if="items.length > 0" :class="className">
    <template v-for="(item, i) in items" :key="i">
      <ChevronRight v-if="i !== 0" class="size-3.5 shrink-0" />
      <Link v-if="item.url" :href="item.url" :class="linkClass(i)">{{ item.name }}</Link>
      <span v-else :class="itemClass(i)">{{ item.name }}</span>
    </template>
  </div>
</template>
