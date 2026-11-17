<script setup lang="ts">
import { computed, h, type Component, type HTMLAttributes, type VNodeChild } from "vue";
import { motion, type Options } from "motion-v";
import { useSearchContext } from "../../contexts/search";
import { cn } from "../../utils/cn";

/** the other attributes and motion props reach the `motion.div` */
defineOptions({ inheritAttrs: false });

const props = defineProps<{ class?: HTMLAttributes["class"]; animate?: Options["animate"] }>();
const slots = defineSlots<{
  head?: () => VNodeChild;
  tabDropdown?: () => VNodeChild;
  tool?: () => VNodeChild;
  link?: () => VNodeChild;
  /**
   * replace default children
   */
  default?: (props: { defaultChildren: Component }) => VNodeChild;
}>();
const { open } = useSearchContext();
const className = computed(() =>
  cn(
    "fixed left-1/2 w-[calc(100%-var(--removed-body-scroll-bar-size,0px))] translate-x-[calc(-50%-var(--removed-body-scroll-bar-size,0px)/2)] bottom-0 z-40 bg-fd-popover text-fd-popover-foreground border-t shadow-lg sm:bottom-6 sm:rounded-2xl sm:border sm:max-w-[380px]",
    props.class,
  ),
);
const animate = computed(
  () =>
    props.animate ?? {
      scale: open.value ? 0.9 : 1,
      translateY: open.value ? 20 : 0,
      opacity: open.value ? 0.8 : 1,
    },
);

const defaultChildren = () => [
  h("div", { class: "flex flex-row items-center ps-2.5 p-1 gap-2 min-h-11" }, [
    slots.head?.(),
    h("div", { id: "flux-layout-slot", class: "flex-1" }),
  ]),
  h("div", { class: "flex flex-row gap-1.5 overflow-x-auto overflow-y-hidden p-2 sm:p-1" }, [
    h("div", { class: "flex flex-row items-center gap-2 min-w-0 flex-1" }, [slots.tabDropdown?.()]),
    h(
      "div",
      {
        class: "flex flex-row items-center text-fd-muted-foreground border-x px-0.5 empty:hidden",
      },
      [slots.link?.()],
    ),
    h("div", { class: "flex flex-row items-center text-fd-muted-foreground empty:hidden" }, [
      slots.tool?.(),
    ]),
  ]),
];
</script>

<template>
  <motion.div v-bind="$attrs" :class="className" :animate="animate">
    <slot :default-children="defaultChildren">
      <component :is="defaultChildren" />
    </slot>
  </motion.div>
</template>
