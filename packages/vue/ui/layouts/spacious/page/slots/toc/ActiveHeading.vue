<script setup lang="ts">
import { computed, shallowRef, watch, type HTMLAttributes } from "vue";
import * as Base from "../../../../../components/toc";
import { useTOCSelector, type TOCItemInfo } from "../../../../../core/toc";
import { cn } from "../../../../../utils/cn";

/** rolls in from the direction of scrolling: the slot `fallback` shows without an active heading */
const props = defineProps<{ class?: HTMLAttributes["class"]; activeClassName?: string }>();

// selectors to re-render only when the value changes
const selectTopmost = (items: TOCItemInfo[]) => items.find((item) => item.active)?.original;

const items = Base.useTOCItems();
const active = useTOCSelector(selectTopmost);
const roll = shallowRef(1);

watch(active, (active, shown) => {
  roll.value = items.value.indexOf(active!) >= items.value.indexOf(shown!) ? 1 : -1;
});

const className = computed(() =>
  cn("flex min-w-0 overflow-hidden", active.value && props.activeClassName, props.class),
);
</script>

<template>
  <span :class="className">
    <span
      :key="active?.url"
      class="truncate motion-safe:animate-fd-roll-in"
      :style="{ '--fd-roll': roll }"
    >
      <template v-if="active">{{ active.title }}</template>
      <slot v-else name="fallback" />
    </span>
  </span>
</template>
