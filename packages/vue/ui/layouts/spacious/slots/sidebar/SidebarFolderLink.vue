<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import * as Base from "../../../../components/sidebar/base";
import { cn } from "../../../../utils/cn";
import { itemVariants } from "./utils";

const props = withDefaults(defineProps<{ active?: boolean; class?: HTMLAttributes["class"] }>(), {
  active: false,
});
const depth = Base.useFolderDepth();
const className = computed(() =>
  cn(itemVariants({ active: props.active }), "[&>[data-icon]]:size-3.5", props.class),
);
</script>

<template>
  <Base.SidebarFolderLink :active="active" :class="className">
    <span v-if="active && depth > 1" class="absolute -start-1 inset-y-2 w-px bg-fd-primary" />
    <slot />
  </Base.SidebarFolderLink>
</template>
