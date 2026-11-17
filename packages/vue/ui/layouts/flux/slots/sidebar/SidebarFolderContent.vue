<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import { motion } from "motion-v";
import * as Base from "../../../../components/sidebar/base";
import { cn } from "../../../../utils/cn";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
const depth = Base.useFolderDepth();
const { open } = Base.useFolder()!;
const className = computed(() =>
  cn(
    "relative",
    depth === 1 &&
      "before:content-[''] before:absolute before:w-px before:inset-y-1 before:bg-fd-border before:start-2.5",
    props.class,
  ),
);
const variants = {
  show: {
    opacity: 1,
  },
  hide: {
    opacity: 0,
  },
};
</script>

<template>
  <Base.SidebarFolderContent :class="className">
    <motion.div initial="hide" :animate="open ? 'show' : 'hide'" exit="hide" :variants="variants">
      <slot />
    </motion.div>
  </Base.SidebarFolderContent>
</template>
