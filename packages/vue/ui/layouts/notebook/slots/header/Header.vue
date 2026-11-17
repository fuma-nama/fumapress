<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import { Languages, SidebarIcon } from "lucide-vue-next";
import { buttonVariants } from "../../../../components/ui/button";
import { useTabsGroups } from "../../../../contexts/tree";
import { cn } from "../../../../utils/cn";
import { LinkItem, RenderNode, type IconItemType } from "../../../shared";
import { useNotebookLayout } from "../../client";
import LayoutHeaderTabs from "./LayoutHeaderTabs.vue";
import NavbarLinkItem from "./NavbarLinkItem.vue";

defineOptions({ inheritAttrs: false });

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
const { slots, navItems, isNavTransparent, props: layout } = useNotebookLayout();
const { open } = slots.value.sidebar?.useSidebar?.() ?? {};
const nav = computed(() => layout.value.nav);
const navMode = computed(() => nav.value?.mode ?? "auto");
const sidebarCollapsible = computed(() => layout.value.sidebar.collapsible ?? true);
const groups = useTabsGroups(() => layout.value.tabs);
const showLayoutTabs = computed(() => layout.value.tabMode === "navbar" && groups.value.length > 0);
const textItems = computed(() => navItems.value.filter((item) => item.type !== "icon"));
const iconItems = computed(() =>
  navItems.value.filter((item): item is IconItemType => item.type === "icon"),
);

const className = computed(() =>
  cn(
    "sticky [grid-area:header] flex flex-col top-(--fd-docs-row-1) z-10 backdrop-blur-sm transition-colors data-[transparent=false]:bg-fd-background/80 layout:[--fd-header-height:--spacing(14)]",
    showLayoutTabs.value && "lg:layout:[--fd-header-height:--spacing(24)]",
    props.class,
  ),
);
const bodyClass = computed(() =>
  cn("flex border-b px-4 gap-2 h-14", navMode.value === "top" && "md:px-6"),
);
const startClass = computed(() =>
  cn(
    "items-center",
    navMode.value === "top" && "flex flex-1",
    navMode.value === "auto" && "hidden has-data-[collapsed=true]:md:flex max-md:flex",
  ),
);
const autoCollapseTriggerClass = cn(
  buttonVariants({
    variant: "ghost",
    size: "icon-sm",
  }),
  "-ms-1.5 text-fd-muted-foreground data-[collapsed=false]:hidden max-md:hidden",
);
const navTitleClass = computed(() =>
  cn("inline-flex items-center gap-2.5 font-semibold", navMode.value === "auto" && "md:hidden"),
);
const searchClass = computed(() =>
  cn(
    "w-full my-auto max-md:hidden",
    navMode.value === "top" ? "ps-2.5 rounded-xl max-w-sm" : "max-w-[240px]",
  ),
);
const iconItemClass = cn(
  buttonVariants({ size: "icon-sm", variant: "ghost" }),
  "text-fd-muted-foreground max-lg:hidden",
);
const sidebarTriggerClass = cn(
  buttonVariants({
    variant: "ghost",
    size: "icon-sm",
    className: "p-2 -me-1.5",
  }),
);
const topCollapseTriggerClass = cn(
  buttonVariants({
    variant: "secondary",
    size: "icon-sm",
  }),
  "text-fd-muted-foreground rounded-full -me-1.5",
);
</script>

<template>
  <RenderNode v-if="nav?.component" :node="nav.component" />
  <header
    v-else
    id="nd-subnav"
    :data-transparent="isNavTransparent && !open"
    v-bind="$attrs"
    :class="className"
  >
    <div data-header-body="" :class="bodyClass">
      <div :class="startClass">
        <component
          :is="slots.sidebar.collapseTrigger"
          v-if="sidebarCollapsible && slots.sidebar && navMode === 'auto'"
          :class="autoCollapseTriggerClass"
        >
          <SidebarIcon />
        </component>
        <component :is="slots.navTitle" v-if="slots.navTitle" :class="navTitleClass" />
        <RenderNode :node="nav?.children" />
      </div>
      <component
        :is="slots.searchTrigger.full"
        v-if="slots.searchTrigger"
        hide-if-disabled
        :class="searchClass"
      />
      <div class="flex flex-1 items-center justify-end md:gap-2">
        <div class="flex items-center gap-6 empty:hidden max-lg:hidden">
          <NavbarLinkItem v-for="(item, i) in textItems" :key="i" :item="item" />
        </div>
        <LinkItem
          v-for="(item, i) in iconItems"
          :key="i"
          :item="item"
          :class="iconItemClass"
          :aria-label="item.label"
        >
          <RenderNode :node="item.icon" />
        </LinkItem>

        <div class="flex items-center md:hidden">
          <component
            :is="slots.searchTrigger.sm"
            v-if="slots.searchTrigger"
            hide-if-disabled
            class="p-2"
          />
          <component :is="slots.sidebar.trigger" v-if="slots.sidebar" :class="sidebarTriggerClass">
            <SidebarIcon />
          </component>
        </div>

        <div class="flex items-center gap-2 max-md:hidden">
          <component :is="slots.languageSelect.root" v-if="slots.languageSelect">
            <Languages class="size-4.5 text-fd-muted-foreground" />
          </component>
          <component :is="slots.themeSwitch" v-if="slots.themeSwitch" />
          <component
            :is="slots.sidebar.collapseTrigger"
            v-if="sidebarCollapsible && slots.sidebar && navMode === 'top'"
            :class="topCollapseTriggerClass"
          >
            <SidebarIcon />
          </component>
        </div>
      </div>
    </div>
    <LayoutHeaderTabs
      v-if="showLayoutTabs"
      data-header-tabs=""
      class="overflow-x-auto border-b px-6 h-10 max-lg:hidden"
      :tabs="layout.tabs"
    />
  </header>
</template>
