<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import { useTabsGroups, useTreePath } from "../../../contexts/tree";
import { usePathname } from "../../../core/framework";
import { Link } from "../../../core/link";
import { cn } from "../../../utils/cn";
import { isLayoutTabActive, RenderNode, type LayoutTab } from "../../shared";

const props = defineProps<{ tabs: LayoutTab[]; class?: HTMLAttributes["class"] }>();
const pathname = usePathname();
const path = useTreePath();
const groups = useTabsGroups(() => props.tabs);
const group = computed(() =>
  groups.value.findLast((group) => typeof group.active?.root !== "string"),
);
const selected = computed(() =>
  group.value?.options.findLast((option) => isLayoutTabActive(option, path.value, pathname.value)),
);
const className = computed(() =>
  cn("flex flex-row items-end gap-6 overflow-auto [grid-area:tabs]", props.class),
);
const tabClass = (tab: LayoutTab) =>
  cn(
    "inline-flex border-b-2 border-transparent transition-colors items-center pb-1.5 font-medium gap-2 text-fd-muted-foreground text-sm text-nowrap hover:text-fd-accent-foreground",
    tab.unlisted && selected.value !== tab && "hidden",
    selected.value === tab && "border-fd-primary text-fd-primary",
  );
</script>

<template>
  <div v-if="group" :class="className">
    <Link v-for="(tab, i) in group.options" :key="i" :href="tab.url" :class="tabClass(tab)">
      <RenderNode :node="tab.title" />
    </Link>
  </div>
</template>
