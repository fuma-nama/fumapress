<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import { SidebarTabsDropdown } from "../../../../components/sidebar/tabs/dropdown";
import { useTabsGroups, useTreePath } from "../../../../contexts/tree";
import { usePathname } from "../../../../core/framework";
import { Link } from "../../../../core/link";
import { cn } from "../../../../utils/cn";
import { isLayoutTabActive, RenderNode, type LayoutTab } from "../../../shared";

const props = defineProps<{ tabs: LayoutTab[]; class?: HTMLAttributes["class"] }>();
const pathname = usePathname();
const path = useTreePath();
const groups = useTabsGroups(() => props.tabs);
const tabs = computed(
  () => groups.value.findLast((group) => typeof group.active?.root !== "string")?.options,
);
const typedTabs = computed(() => {
  return props.tabs.filter((tab) => typeof tab.$folder?.root === "string");
});
const selectedIdx = computed(() => {
  return (
    tabs.value?.findLastIndex((option) => isLayoutTabActive(option, path.value, pathname.value)) ??
    -1
  );
});
const className = computed(() => cn("flex flex-row items-end gap-6", props.class));

function tabProps(option: LayoutTab, i: number) {
  const { class: className, ...rest } = option.props ?? {};
  const isSelected = selectedIdx.value === i;

  return {
    ...rest,
    class: cn(
      "inline-flex border-b-2 border-transparent transition-colors items-center pb-1.5 font-medium gap-2 text-fd-muted-foreground text-sm text-nowrap hover:text-fd-accent-foreground",
      option.unlisted && !isSelected && "hidden",
      isSelected && "border-fd-primary text-fd-primary",
      className,
    ),
  };
}
</script>

<template>
  <div :class="className">
    <SidebarTabsDropdown v-if="typedTabs.length > 0" :options="typedTabs" class="my-auto p-1" />
    <Link v-for="(option, i) in tabs" :key="i" :href="option.url" v-bind="tabProps(option, i)">
      <RenderNode :node="option.title" />
    </Link>
  </div>
</template>
