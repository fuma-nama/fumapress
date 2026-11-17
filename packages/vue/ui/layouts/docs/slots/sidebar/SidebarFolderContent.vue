<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import * as Base from "../../../../components/sidebar/base";
import { cn } from "../../../../utils/cn";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
const depth = Base.useFolderDepth();
const className = computed(() =>
  cn(
    "relative flex flex-col gap-0.5 pt-0.5",
    depth === 1 &&
      "before:content-[''] before:absolute before:w-px before:inset-y-1 before:bg-fd-border before:inset-s-2.5",
    props.class,
  ),
);
</script>

<template>
  <Base.SidebarFolderContent :class="className">
    <slot />
  </Base.SidebarFolderContent>
</template>
