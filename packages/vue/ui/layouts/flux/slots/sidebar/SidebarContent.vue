<script setup lang="ts">
import { computed, shallowRef, watch, type HTMLAttributes } from "vue";
import { motion } from "motion-v";
import * as Base from "../../../../components/sidebar/base";
import { cn } from "../../../../utils/cn";
import { useHotKey } from "../../../../utils/hotkey";
import { useRemoveScroll } from "../../context";

/** the other attributes reach the `<aside>` */
defineOptions({ inheritAttrs: false });

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
const blockScroll = shallowRef(false);
const { open, setOpen } = Base.useSidebar();

useHotKey(
  (e) => {
    if (e.key === "Escape") {
      setOpen(false);
      e.preventDefault();
    }
  },
  { enabled: open },
);

watch(
  open,
  (open) => {
    if (open && !blockScroll.value) blockScroll.value = true;
  },
  { immediate: true },
);

// `<RemoveScroll />`, the root `<div>` is its container
useRemoveScroll(blockScroll);

const overlayClass = computed(() =>
  cn(
    "fixed inset-0 py-10 z-30 backdrop-blur-md bg-fd-background/60",
    !open.value && "pointer-events-none",
  ),
);
const asideClass = computed(() => cn("mx-auto sm:max-w-[400px]", props.class));
const overlayVariants = {
  show: {
    opacity: 1,
  },
  hide: {
    opacity: 0,
  },
};
const contentVariants = {
  show: {
    y: 0,
    opacity: 1,
  },
  hide: {
    y: "80%",
    opacity: 0,
  },
};
const contentTransition = {
  duration: 0.4,
  ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
};

function onAnimationComplete(definition: unknown) {
  if (definition === "hide") blockScroll.value = false;
}
</script>

<template>
  <div>
    <motion.div
      :class="overlayClass"
      initial="hide"
      :variants="overlayVariants"
      :animate="open ? 'show' : 'hide'"
      exit="hide"
      @click="setOpen(false)"
      @animation-complete="onAnimationComplete"
    >
      <motion.div
        class="absolute top-0 min-h-0 inset-x-0 bottom-26 overflow-y-auto fd-scroll-container pr-(--removed-body-scroll-bar-size,0) py-16 mask-[linear-gradient(to_bottom,transparent,white_--spacing(14),white_calc(100%---spacing(14)),transparent)] lg:text-sm"
        :variants="contentVariants"
        :transition="contentTransition"
      >
        <motion.aside id="nd-sidebar" :class="asideClass" v-bind="$attrs" @click.stop>
          <slot />
        </motion.aside>
      </motion.div>
    </motion.div>
  </div>
</template>
