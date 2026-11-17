<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import * as Base from "../../../../components/sidebar/base";
import { cn } from "../../../../utils/cn";
import { getItemOffset, itemVariants } from "./utils";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
const depth = Base.useFolderDepth();
const className = computed(() =>
  cn(itemVariants({ variant: "link", highlight: depth > 1 }), "w-full", props.class),
);
</script>

<template>
  <Base.SidebarFolderLink
    :class="className"
    :style="{ paddingInlineStart: getItemOffset(depth - 1) }"
  >
    <slot />
  </Base.SidebarFolderLink>
</template>
