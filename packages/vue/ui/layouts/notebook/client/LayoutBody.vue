<script setup lang="ts">
import { computed, provide } from "vue";
import { TreeContextProvider } from "../../../contexts/tree";
import { useIsScrollTop } from "../../../utils/use-is-scroll-top";
import { RenderNode, useLinkItems, type LayoutTab } from "../../shared";
import { AIChatPanel, AIChatTrigger, SkipToContent } from "../../shared/client";
import type { DocsLayoutProps } from "../index";
import { Container } from "../slots/container";
import { Header } from "../slots/header";
import {
  Sidebar,
  SidebarCollapseTrigger,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "../slots/sidebar";
import { LayoutKey, useBaseSlots } from "./context";
import type { DocsSlots } from "./index";

const props = withDefaults(
  defineProps<
    Omit<DocsLayoutProps, "tabs"> & {
      tabs: LayoutTab[];
    }
  >(),
  // a boolean prop is `false` without a default
  { i18n: undefined, tabMode: "sidebar" },
);
const options = computed(() => {
  const {
    nav: { enabled: navEnabled = true, transparentMode: navTransparentMode = "none" } = {},
    sidebar: { defaultOpenLevel, prefetch, ...sidebarProps } = {},
  } = props;

  return { navEnabled, navTransparentMode, defaultOpenLevel, prefetch, sidebarProps };
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
    collapseTrigger: SidebarCollapseTrigger,
    useSidebar,
  },
}));

provide(LayoutKey, {
  props: computed(() => ({
    tabs: props.tabs,
    tabMode: props.tabMode,
    sidebar: options.value.sidebarProps,
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
      :collapsible="options.sidebarProps.collapsible"
    >
      <component :is="slots.container" v-bind="containerProps">
        <SkipToContent />
        <component :is="slots.header" v-if="options.navEnabled" />
        <component :is="slots.sidebar.root" v-bind="options.sidebarProps" />
        <slot />
        <AIChatPanel
          v-if="aiChat?.panel"
          :open="aiChat.open"
          class="[grid-area:toc] justify-self-end xl:sticky xl:max-w-full xl:top-(--fd-docs-row-3) xl:h-[calc(var(--fd-docs-height)-var(--fd-docs-row-3))] xl:border-s"
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
