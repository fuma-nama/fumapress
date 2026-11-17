<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import * as Base from "../../../../components/sidebar/base";
import { cn } from "../../../../utils/cn";
import { getItemOffset, itemVariants } from "./utils";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
const depth = Base.useFolderDepth();
const className = computed(() =>
  cn(itemVariants({ variant: "link", highlight: depth >= 1 }), props.class),
);
</script>

<template>
  <Base.SidebarItem :class="className" :style="{ paddingInlineStart: getItemOffset(depth) }">
    <template v-if="$slots.icon" #icon><slot name="icon" /></template>
    <template #default><slot /></template>
  </Base.SidebarItem>
</template>
