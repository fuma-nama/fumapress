<script setup lang="ts">
import { computed, provide } from "vue";
import { TreeContextProvider } from "../../../contexts/tree";
import { useIsScrollTop } from "../../../utils/use-is-scroll-top";
import { RenderNode, useLinkItems, type LayoutTab } from "../../shared";
import { AIChatPanel, AIChatTrigger, SkipToContent } from "../../shared/client";
import type { DocsLayoutProps } from "../index";
import { Container } from "../slots/container";
import { Header } from "../slots/header";
import { Sidebar, SidebarProvider, SidebarTrigger, useSidebar } from "../slots/sidebar";
import { LayoutKey, useBaseSlots } from "./context";
import type { DocsSlots } from "./index";
import LayoutTabs from "./LayoutTabs.vue";

const props = withDefaults(
  defineProps<
    Omit<DocsLayoutProps, "tabs"> & {
      tabs: LayoutTab[];
    }
  >(),
  // a boolean prop is `false` without a default
  { i18n: undefined },
);
const options = computed(() => {
  const {
    nav: { enabled: navEnabled = true, transparentMode: navTransparentMode = "none" } = {},
    sidebar: {
      enabled: sidebarEnabled = true,
      defaultOpenLevel,
      prefetch,
      banner,
      footer,
      ...sidebarProps
    } = {},
    tabMode = "auto",
  } = props;

  return {
    navEnabled,
    navTransparentMode,
    sidebarEnabled,
    defaultOpenLevel,
    prefetch,
    banner,
    footer,
    sidebarProps,
    tabMode,
  };
});
const isTop = useIsScrollTop({ enabled: () => options.value.navTransparentMode === "top" });
const isNavTransparent = computed(() =>
  options.value.navTransparentMode === "top"
    ? (isTop.value ?? true)
    : options.value.navTransparentMode === "always",
);
const { baseSlots, baseProps } = useBaseSlots(props);
const linkItems = useLinkItems(props);
const slots = computed<DocsSlots>(() => ({
  ...baseSlots.value,
  header: props.slots?.header ?? Header,
  container: props.slots?.container ?? Container,
  sidebar: props.slots?.sidebar ?? {
    provider: SidebarProvider,
    root: Sidebar,
    trigger: SidebarTrigger,
    useSidebar: useSidebar,
  },
}));

provide(LayoutKey, {
  props: computed(() => ({
    tabMode: options.value.tabMode,
    tabs: props.tabs,
    aiChat: props.aiChat,
    ...baseProps.value,
  })),
  isNavTransparent,
  slots,
  navItems: computed(() => linkItems.value.navItems),
  menuItems: computed(() => linkItems.value.menuItems),
});
</script>

<template>
  <TreeContextProvider :tree="tree">
    <component
      :is="slots.sidebar.provider"
      :default-open-level="options.defaultOpenLevel"
      :prefetch="options.prefetch"
      :collapsible="options.sidebarEnabled && options.sidebarProps.collapsible"
    >
      <component :is="slots.container" v-bind="containerProps">
        <SkipToContent />
        <component :is="slots.header" v-if="options.navEnabled" />
        <component
          :is="slots.sidebar.root"
          v-if="options.sidebarEnabled"
          v-bind="options.sidebarProps"
        >
          <template v-if="options.banner" #banner><RenderNode :node="options.banner" /></template>
          <template v-if="options.footer" #footer><RenderNode :node="options.footer" /></template>
        </component>
        <LayoutTabs
          v-if="options.tabMode === 'top' && tabs.length > 0"
          :tabs="tabs"
          class="z-10 bg-fd-background border-b px-6 pt-3 xl:px-8 max-md:hidden"
        />
        <slot />
        <AIChatPanel
          v-if="aiChat?.panel"
          :open="aiChat.open"
          class="[grid-area:toc] justify-self-end xl:sticky xl:top-(--fd-docs-row-1) xl:h-[calc(var(--fd-docs-height)-var(--fd-docs-row-1))] xl:border-s"
        >
          <RenderNode :node="aiChat.panel" />
        </AIChatPanel>
        <AIChatTrigger
          v-if="aiChat?.trigger"
          :open="aiChat.open"
          @update:open="aiChat.onOpenChange"
        />
      </component>
    </component>
  </TreeContextProvider>
</template>
