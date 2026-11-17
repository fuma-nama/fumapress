<script setup lang="ts">
import { computed, h, provide, type VNodeChild } from "vue";
import { Languages } from "lucide-vue-next";
import { buttonVariants } from "../../components/ui/button";
import { TreeContextProvider } from "../../contexts/tree";
import { cn } from "../../utils/cn";
import { getLayoutTabs, LinkItem, RenderNode, useLinkItems, type IconItemType } from "../shared";
import { LayoutKey, useBaseSlots } from "./context";
import type { DocsLayoutProps, DocsSlots, NavigationPanelProps } from "./index";
import NavigationPanel from "./NavigationPanel.vue";
import { Container } from "./slots/container";
import { Sidebar, SidebarProvider, SidebarTrigger, useSidebar } from "./slots/sidebar";
import { TabDropdown } from "./slots/tab-dropdown";

const props = withDefaults(defineProps<DocsLayoutProps>(), {
  // a boolean prop is `false` without a default
  tabs: undefined,
  i18n: undefined,
});
defineSlots<{
  default?: () => VNodeChild;
  renderNavigationPanel?: (props: NavigationPanelProps) => VNodeChild;
}>();

const options = computed(() => {
  const {
    nav = {},
    sidebar: {
      enabled: sidebarEnabled = true,
      tabs: _tabs,
      defaultOpenLevel,
      prefetch,
      banner,
      footer,
      ...sidebarProps
    } = {},
    tabs: defaultTabs = _tabs,
  } = props;

  return {
    nav,
    sidebarEnabled,
    defaultOpenLevel,
    prefetch,
    banner,
    footer,
    sidebarProps,
    defaultTabs,
  };
});
const linkItems = useLinkItems(props);
const { baseSlots, baseProps } = useBaseSlots(props);

const tabs = computed(() => {
  const { defaultTabs } = options.value;

  if (Array.isArray(defaultTabs)) {
    return defaultTabs;
  }
  if (typeof defaultTabs === "object") {
    return getLayoutTabs(props.tree, defaultTabs);
  }
  if (defaultTabs !== false) {
    return getLayoutTabs(props.tree);
  }
  return [];
});
const slots = computed<DocsSlots>(() => ({
  ...baseSlots.value,
  container: props.slots?.container ?? Container,
  tabDropdown: props.slots?.tabDropdown ?? TabDropdown,
  sidebar: props.slots?.sidebar ?? {
    root: Sidebar,
    provider: SidebarProvider,
    trigger: SidebarTrigger,
    useSidebar,
  },
}));

provide(LayoutKey, {
  props: baseProps,
  slots,
  menuItems: computed(() => linkItems.value.menuItems),
  navItems: computed(() => linkItems.value.navItems),
});

const sidebarTriggerClass = cn(
  buttonVariants({
    variant: "ghost",
    size: "icon-sm",
    className: "overflow-hidden",
  }),
);
const iconLinkClass = cn(buttonVariants({ size: "icon-sm", variant: "ghost" }));

// the parts of the navigation panel, passed to `renderNavigationPanel`
const head = () => [
  slots.value.navTitle &&
    h(slots.value.navTitle, { class: "inline-flex items-center gap-2.5 text-sm font-semibold" }),
  h(RenderNode, { node: options.value.nav.children }),
];
const tabDropdown = () =>
  slots.value.tabDropdown &&
  tabs.value.length > 0 &&
  h(slots.value.tabDropdown, { class: "flex-1", tabs: tabs.value });
const tool = () => {
  const { languageSelect, searchTrigger, sidebar, themeSwitch } = slots.value;

  return [
    languageSelect && h(languageSelect.root, null, () => h(Languages, { class: "size-4.5" })),
    searchTrigger && h(searchTrigger.sm, { hideIfDisabled: true, class: "rounded-lg" }),
    sidebar && h(sidebar.trigger, { class: sidebarTriggerClass }),
    themeSwitch && h(themeSwitch, { class: "p-1 h-full ms-1 rounded-xl bg-fd-muted *:rounded-lg" }),
  ];
};
const link = () =>
  linkItems.value.menuItems
    .filter((item): item is IconItemType => item.type === "icon")
    .map((item, i) =>
      h(LinkItem, { key: i, item, class: iconLinkClass, "aria-label": item.label }, () =>
        h(RenderNode, { node: item.icon }),
      ),
    );
const panel: NavigationPanelProps = { head, tabDropdown, tool, link };
</script>

<template>
  <TreeContextProvider :tree="tree">
    <component
      :is="slots.sidebar.provider"
      :default-open-level="options.defaultOpenLevel"
      :prefetch="options.prefetch"
    >
      <component :is="slots.container" v-bind="containerProps">
        <component
          :is="slots.sidebar.root"
          v-if="options.sidebarEnabled"
          v-bind="options.sidebarProps"
        >
          <template v-if="options.banner" #banner><RenderNode :node="options.banner" /></template>
          <template v-if="options.footer" #footer><RenderNode :node="options.footer" /></template>
        </component>
        <slot />
      </component>
      <slot name="renderNavigationPanel" v-bind="panel">
        <NavigationPanel>
          <template #head><component :is="head" /></template>
          <template #tabDropdown><component :is="tabDropdown" /></template>
          <template #tool><component :is="tool" /></template>
          <template #link><component :is="link" /></template>
        </NavigationPanel>
      </slot>
    </component>
  </TreeContextProvider>
</template>
