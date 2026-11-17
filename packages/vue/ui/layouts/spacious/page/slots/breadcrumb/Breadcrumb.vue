<script setup lang="ts">
import { computed } from "vue";
import { Link } from "../../../../../core/link";
import { cn } from "../../../../../utils/cn";
import type { BreadcrumbProps } from "./index";
import { useBreadcrumbItems } from "./utils";

/**
 * The folders of current page
 */
defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<BreadcrumbProps>(), {
  // a boolean prop is `false` without a default
  includeRoot: undefined,
  includeSeparator: undefined,
  includePage: undefined,
});
const items = useBreadcrumbItems(() => ({
  includeRoot: props.includeRoot,
  includeSeparator: props.includeSeparator,
  includePage: props.includePage,
}));
const className = computed(() =>
  cn("flex items-center gap-1.5 min-w-0 text-sm text-fd-muted-foreground", props.class),
);
</script>

<template>
  <nav v-if="items.length > 0" :class="className" v-bind="$attrs">
    <template v-for="(item, i) in items" :key="i">
      <span v-if="i > 0" class="shrink-0 text-fd-muted-foreground/50">/</span>
      <Link
        v-if="item.url"
        :href="item.url"
        class="truncate transition-colors hover:text-fd-accent-foreground"
        >{{ item.name }}</Link
      >
      <span v-else class="truncate">{{ item.name }}</span>
    </template>
  </nav>
</template>
