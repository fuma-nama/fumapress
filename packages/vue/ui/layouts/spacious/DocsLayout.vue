<script setup lang="ts">
import { computed, provide } from "vue";
import { TreeContextProvider } from "../../contexts/tree";
import { cn } from "../../utils/cn";
import { getLayoutTabs, RenderNode, useLinkItems } from "../shared";
import { AIChatPanel, SkipToContent } from "../shared/client";
import { LayoutKey, useBaseSlots } from "./context";
import type { DocsLayoutProps, DocsSlots } from "./index";
import { HeaderActions } from "./slots/actions";
import { Header } from "./slots/header";
import { Sidebar, SidebarDrawer, SidebarProvider } from "./slots/sidebar";

const props = withDefaults(defineProps<DocsLayoutProps>(), {
  // a boolean prop is `false` without a default
  tabs: undefined,
  i18n: undefined,
});
const linkItems = useLinkItems(() => props);
const { baseSlots, baseProps } = useBaseSlots(() => props);
const tabs = computed(() => {
  const { tree, tabs: tabsOptions } = props;

  if (Array.isArray(tabsOptions)) return tabsOptions;
  if (tabsOptions === false) return [];
  return getLayoutTabs(tree, { transform: (option) => option, ...tabsOptions });
});

const slots = computed<DocsSlots>(() => {
  const customSlots = props.slots ?? {};

  return {
    ...baseSlots.value,
    header: customSlots.header ?? Header,
    actions: customSlots.actions ?? HeaderActions,
    sidebar: customSlots.sidebar ?? {
      provider: SidebarProvider,
      main: Sidebar,
      drawer: SidebarDrawer,
    },
  };
});

provide(LayoutKey, {
  props: computed(() => ({ tabs: tabs.value, aiChat: props.aiChat, ...baseProps.value })),
  slots,
  navItems: computed(() => linkItems.value.navItems),
  menuItems: computed(() => linkItems.value.menuItems),
});

const style = {
  gridTemplate: `"sidebar header right" auto
"sidebar toc-popover right" var(--fd-toc-popover-height, 0px)
"sidebar main right" 1fr / var(--fd-sidebar-col) minmax(0, 1fr) auto`,
};
const aiChatClass = computed(() =>
  cn(
    "[grid-area:right] xl:my-2 xl:rounded-2xl xl:border xl:bg-fd-background xl:shadow-sm",
    props.aiChat?.open && "xl:me-2",
  ),
);
</script>

<template>
  <TreeContextProvider :tree="tree">
    <component :is="slots.sidebar.provider" v-bind="sidebar">
      <!-- like docs layouts, `--fd-docs-row-3` is the height of the bars above the page on mobile -->
      <div
        id="fd-spacious-layout"
        class="relative grid min-h-(--fd-layout-height) bg-fd-card transition-[grid-template-columns] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none [--fd-layout-height:calc(100dvh-var(--fd-banner-height,0px))] [--fd-header-height:--spacing(14)] [--fd-page-width:760px] [--fd-sidebar-width:0px] [--fd-sidebar-col:var(--fd-sidebar-width)] [--fd-toc-width:0px] max-md:[--fd-docs-row-3:calc(var(--fd-banner-height,0px)+var(--fd-header-height)+var(--fd-toc-popover-height,0px))] md:h-(--fd-layout-height) md:overflow-clip print:h-auto print:overflow-visible"
        :style="style"
      >
        <SkipToContent />
        <component :is="slots.sidebar.main" />
        <component :is="slots.header" />
        <slot />
        <AIChatPanel v-if="aiChat?.panel" :open="aiChat.open" :class="aiChatClass">
          <RenderNode :node="aiChat.panel" />
        </AIChatPanel>
        <component :is="slots.sidebar.drawer" />
      </div>
    </component>
  </TreeContextProvider>
</template>
