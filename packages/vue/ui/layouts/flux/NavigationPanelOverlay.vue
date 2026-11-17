<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import { motion } from "motion-v";
import { cn } from "../../utils/cn";
import { useRemoveScroll } from "./context";

/** the other attributes and motion props reach the `motion.div` */
defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<{ enabled?: boolean; class?: HTMLAttributes["class"] }>(), {
  enabled: false,
});

// `<RemoveScroll />`, the root `<div>` is its container
useRemoveScroll(() => props.enabled);

const className = computed(() =>
  cn(
    "fixed inset-0 z-30 pr-(--removed-body-scroll-bar-size,0) backdrop-blur-md bg-fd-background/60",
    !props.enabled && "pointer-events-none",
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
  <div>
    <motion.div
      :class="className"
      initial="hide"
      :variants="variants"
      :animate="enabled ? 'show' : 'hide'"
      exit="hide"
      v-bind="$attrs"
    >
      <slot />
    </motion.div>
  </div>
</template>
