<script setup lang="ts">
import { computed, provide } from "vue";
import { TreeContextProvider } from "../../contexts/tree";
import { getLayoutTabs, RenderNode, useLinkItems } from "../shared";
import { AIChatPanel, SkipToContent } from "../shared/client";
import { LayoutKey, useBaseSlots } from "./context";
import type { DocsLayoutProps, DocsSlots } from "./index";
import { Header } from "./slots/header";
import { drawerHandle, Sidebar, SidebarDrawer, SidebarProvider, useSidebar } from "./slots/sidebar";

const props = withDefaults(defineProps<DocsLayoutProps>(), {
  // a boolean prop is `false` without a default
  tabs: undefined,
  i18n: undefined,
});
const linkItems = useLinkItems(() => props);
const { baseSlots, baseProps } = useBaseSlots(() => props);

const tabs = computed(() => {
  const defaultTabs = props.tabs;

  if (Array.isArray(defaultTabs)) return defaultTabs;
  if (defaultTabs === false) return [];
  return getLayoutTabs(props.tree, { transform: (option) => option, ...defaultTabs });
});

const layoutSlots = computed<DocsSlots>(() => ({
  ...baseSlots.value,
  header: props.slots?.header ?? Header,
  sidebar: props.slots?.sidebar ?? {
    drawer: SidebarDrawer,
    drawerHandle,
    main: Sidebar,
    provider: SidebarProvider,
    use: useSidebar,
  },
}));

provide(LayoutKey, {
  props: computed(() => ({
    tabs: tabs.value,
    aiChat: props.aiChat,
    ...baseProps.value,
  })),
  slots: layoutSlots,
  navItems: computed(() => linkItems.value.navItems),
  menuItems: computed(() => linkItems.value.menuItems),
});

const leftSpace = "calc(50% - var(--fd-main-width)/2 - var(--fd-left-width))";
const style = {
  gridTemplate: `"left left-margin main right-margin right" 1fr / var(--fd-left-width) ${leftSpace} 1fr minmax(calc(50% - var(--fd-main-width)/2 - var(--fd-right-width) + min(${leftSpace}, 0px)), auto) var(--fd-right-width)`,
};
</script>

<template>
  <component :is="layoutSlots.sidebar.provider" v-bind="sidebar ?? {}">
    <TreeContextProvider :tree="tree">
      <div
        id="fd-glass-layout"
        class="grid overflow-x-clip min-h-dvh [--fd-main-width:900px] [--fd-left-width:0px] [--fd-right-width:0px]"
        :style="style"
      >
        <SkipToContent />
        <component :is="layoutSlots.sidebar.drawer" />
        <component :is="layoutSlots.sidebar.main" />
        <component :is="layoutSlots.header" />
        <slot />
        <AIChatPanel
          v-if="aiChat?.panel"
          :open="aiChat.open"
          class="[grid-area:right/right-margin/right/right] justify-self-end xl:sticky xl:top-[calc(var(--fd-header-height)+--spacing(2))] xl:h-[calc(100dvh-var(--fd-header-height)---spacing(4))] xl:me-2 xl:rounded-2xl xl:border xl:bg-fd-popover xl:shadow-sm"
        >
          <RenderNode :node="aiChat.panel" />
        </AIChatPanel>
      </div>
    </TreeContextProvider>
  </component>
</template>
