<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import * as Base from "../../../../components/sidebar/base";
import { cn } from "../../../../utils/cn";
import { itemVariants } from "./utils";

const props = withDefaults(defineProps<{ active?: boolean; class?: HTMLAttributes["class"] }>(), {
  active: false,
});
const depth = Base.useFolderDepth();
const className = computed(() => cn(itemVariants({ active: props.active }), props.class));
</script>

<template>
  <Base.SidebarItem :active="active" :class="className">
    <template v-if="$slots.icon" #icon><slot name="icon" /></template>
    <template #default>
      <span v-if="active && depth > 0" class="absolute -start-1 inset-y-2 w-px bg-fd-primary" />
      <slot />
    </template>
  </Base.SidebarItem>
</template>
