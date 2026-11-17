<script setup lang="ts">
import { computed } from "vue";
import { getLayoutTabs } from "../shared";
import { LayoutBody } from "./client";
import type { DocsLayoutProps } from "./index";

const props = withDefaults(defineProps<DocsLayoutProps>(), {
  // a boolean prop is `false` without a default
  tabs: undefined,
  i18n: undefined,
});
const layoutTabs = computed(() => (props.tabs === undefined ? props.sidebar?.tabs : props.tabs));
const tabs = computed(() => {
  const tree = props.tree;

  if (Array.isArray(layoutTabs.value)) {
    return layoutTabs.value;
  }
  if (typeof layoutTabs.value === "object") {
    return getLayoutTabs(tree, layoutTabs.value);
  }
  if (layoutTabs.value !== false) {
    return getLayoutTabs(tree);
  }
  return [];
});
// the other props reach the body as they are
const body = computed(() => {
  const {
    sidebar: { tabs: _tabs, tabMode: _tabMode, ...sidebarProps } = {},
    tabs: _layoutTabs,
    tabMode = _tabMode,
    ...rest
  } = props;

  return { ...rest, tabMode, sidebar: sidebarProps };
});
</script>

<template>
  <LayoutBody v-bind="body" :tabs="tabs">
    <slot />
  </LayoutBody>
</template>
