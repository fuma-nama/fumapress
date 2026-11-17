<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import * as Base from "../../../../components/sidebar/base";
import { cn } from "../../../../utils/cn";
import { getItemOffset, itemVariants } from "./utils";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
const { depth, collapsible } = Base.useFolder()!;
const className = computed(() =>
  cn(itemVariants({ variant: collapsible.value ? "button" : null }), "w-full", props.class),
);
</script>

<template>
  <Base.SidebarFolderTrigger
    :class="className"
    :style="{ paddingInlineStart: getItemOffset(depth - 1) }"
  >
    <slot />
  </Base.SidebarFolderTrigger>
</template>
