<script setup lang="ts">
import { computed, shallowRef } from "vue";
import { Check, ChevronsUpDown } from "../../../../icons";
import { AnimatePresence, motion } from "motion-v";
import { Popover, PopoverContent, PopoverTrigger } from "../../../../components/ui/popover";
import { useTabsGroups, useTreePath } from "../../../../contexts/tree";
import { usePathname } from "../../../../core/framework";
import { Link } from "../../../../core/link";
import { cn } from "../../../../utils/cn";
import { isLayoutTabActive, RenderNode, type LayoutTab } from "../../../shared";
import type { TabDropdownProps } from "./index";

defineOptions({ inheritAttrs: false });

const props = defineProps<TabDropdownProps>();
const open = shallowRef(false);
const pathname = usePathname();
const path = useTreePath();
const groups = useTabsGroups(() => props.tabs);
const tabs = computed(
  () => groups.value.findLast((group) => typeof group.active?.root !== "string")?.options,
);
const selectedIdx = computed(() => {
  return (
    tabs.value?.findLastIndex((item) => isLayoutTabActive(item, path.value, pathname.value)) ?? -1
  );
});
const selected = computed(() =>
  selectedIdx.value !== -1 ? tabs.value?.[selectedIdx.value] : undefined,
);

const onClick = () => {
  open.value = false;
};

const initial = {
  opacity: 0,
  y: "100%",
};
const animate = {
  opacity: 1,
  y: 0,
};
const exit = {
  opacity: 0,
  y: "-100%",
};

const triggerClass = computed(() =>
  cn(
    "flex items-center gap-2 rounded-xl overflow-hidden p-1.5 border shadow-sm text-sm text-start transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground data-[state=open]:bg-fd-accent data-[state=open]:text-fd-accent-foreground",
    props.class,
  ),
);
const linkProps = (item: LayoutTab) => ({
  ...item.props,
  class: cn(
    "flex items-center gap-1.5 rounded-lg p-1.5 hover:bg-fd-accent hover:text-fd-accent-foreground",
    item.props?.class,
  ),
});
const checkClass = (isActive: boolean) =>
  cn("shrink-0 ms-auto size-3.5 text-fd-primary", !isActive && "invisible");
</script>

<template>
  <Popover v-if="tabs" v-model:open="open">
    <PopoverTrigger v-if="selected || $slots.placeholder" v-bind="$attrs" :class="triggerClass">
      <AnimatePresence mode="popLayout">
        <motion.span
          :key="selectedIdx"
          class="flex w-full min-w-0 overflow-hidden items-center text-nowrap gap-1.5"
          :initial="initial"
          :animate="animate"
          :exit="exit"
        >
          <template v-if="selected">
            <div class="size-4.5 shrink-0 empty:hidden"><RenderNode :node="selected.icon" /></div>
            <p class="font-medium"><RenderNode :node="selected.title" /></p>
          </template>
          <slot v-else name="placeholder" />
        </motion.span>
      </AnimatePresence>

      <ChevronsUpDown class="shrink-0 ms-auto size-4 text-fd-muted-foreground" />
    </PopoverTrigger>
    <PopoverContent align="start" class="flex flex-col gap-1 max-w-svw p-1 fd-scroll-container">
      <template v-for="(item, i) in tabs" :key="item.url">
        <Link
          v-if="i === selectedIdx || !item.unlisted"
          :href="item.url"
          v-bind="linkProps(item)"
          @click="onClick"
        >
          <div class="shrink-0 mb-auto size-4.5 empty:hidden"><RenderNode :node="item.icon" /></div>
          <div>
            <p class="text-sm font-medium leading-none"><RenderNode :node="item.title" /></p>
            <p class="text-[0.8125rem] text-fd-muted-foreground mt-1 empty:hidden">
              <RenderNode :node="item.description" />
            </p>
          </div>

          <Check :class="checkClass(i === selectedIdx)" />
        </Link>
      </template>
    </PopoverContent>
  </Popover>
</template>
