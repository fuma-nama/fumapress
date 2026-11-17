<script setup lang="ts">
import { computed, shallowRef, type HTMLAttributes } from "vue";
import { ChevronsUpDown } from "../../../icons";
import { Popover, PopoverContent, PopoverTrigger } from "../../../components/ui/popover";
import { useTabsGroups, useTreePath } from "../../../contexts/tree";
import { usePathname } from "../../../core/framework";
import { Link } from "../../../core/link";
import { useTranslations } from "../../../core/translate";
import { cn } from "../../../utils/cn";
import { isLayoutTabActive, RenderNode, type LayoutTab } from "../../shared";

// the other attributes reach the trigger
defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{ tabs: LayoutTab[]; size?: "default" | "lg"; class?: HTMLAttributes["class"] }>(),
  { size: "default" },
);
const path = useTreePath();
const pathname = usePathname();
const t = useTranslations();
const groups = useTabsGroups(() => props.tabs);
const tabs = computed(
  () => groups.value.findLast((group) => typeof group.active?.root !== "string")?.options ?? [],
);
const selected = computed(() =>
  tabs.value.findLast((t) => isLayoutTabActive(t, path.value, pathname.value)),
);
const open = shallowRef(false);

const triggerClass = computed(() =>
  cn(
    "inline-flex items-center gap-2 text-sm font-medium rounded-full transition-colors [&_svg]:size-4 hover:bg-fd-accent data-[state=open]:bg-fd-accent",
    props.size === "lg" && "text-[0.9375rem]",
    props.class,
  ),
);
const chevronClass = computed(() =>
  cn(
    "ms-auto shrink-0 text-fd-muted-foreground",
    props.size === "default" && "size-3.5!",
    props.size === "lg" && "size-4!",
  ),
);
const linkClass = (tab: LayoutTab) =>
  cn(
    "text-sm px-2 py-1.5 rounded-lg",
    selected.value === tab
      ? "bg-fd-primary/10 text-fd-primary"
      : "hover:bg-fd-accent hover:text-fd-accent-foreground",
  );
const descriptionClass = (tab: LayoutTab) =>
  cn(
    "mt-1 text-xs text-fd-muted-foreground empty:hidden",
    selected.value === tab && "text-fd-primary/80",
  );
</script>

<template>
  <Popover v-if="tabs.length > 0" v-model:open="open">
    <PopoverTrigger :class="triggerClass" v-bind="$attrs">
      <template v-if="selected">
        <RenderNode :node="selected.icon" />
        <span class="truncate"><RenderNode :node="selected.title" /></span>
      </template>
      <span v-else class="text-fd-muted-foreground truncate">
        {{ t("Layout Tab", { note: "layout tab trigger" }) }}
      </span>
      <ChevronsUpDown :class="chevronClass" />
    </PopoverTrigger>
    <PopoverContent class="flex flex-col p-1 rounded-xl" align="start">
      <template v-for="(tab, i) in tabs" :key="i">
        <Link
          v-if="!(tab.unlisted && tab !== selected)"
          :href="tab.url"
          :class="linkClass(tab)"
          @click="open = false"
        >
          <div class="font-medium inline-flex items-center gap-2 [&_svg]:size-4">
            <RenderNode :node="tab.icon" />
            <RenderNode :node="tab.title" />
          </div>
          <p :class="descriptionClass(tab)"><RenderNode :node="tab.description" /></p>
        </Link>
      </template>
    </PopoverContent>
  </Popover>
</template>
