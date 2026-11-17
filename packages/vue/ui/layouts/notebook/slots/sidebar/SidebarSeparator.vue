<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import * as Base from "../../../../components/sidebar/base";
import { cn } from "../../../../utils/cn";
import { getItemOffset } from "./utils";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
const depth = Base.useFolderDepth();
const className = computed(() =>
  cn(
    "inline-flex items-center gap-2 mb-1.5 px-2 mt-6 empty:mb-0 [&_svg]:size-4 [&_svg]:shrink-0",
    depth === 0 && "first:mt-0",
    props.class,
  ),
);
</script>

<template>
  <Base.SidebarSeparator :class="className" :style="{ paddingInlineStart: getItemOffset(depth) }">
    <slot />
  </Base.SidebarSeparator>
</template>
