<script setup lang="ts">
import { computed } from "vue";
import { getLayoutTabs } from "../shared";
import { LayoutBody } from "./client";
import type { DocsLayoutProps } from "./index";

const props = withDefaults(defineProps<DocsLayoutProps>(), {
  // a boolean prop is `false` without a default
  tabs: undefined,
  i18n: undefined,
  tabMode: "sidebar",
});
const resolvedTabs = computed(() => {
  const tree = props.tree;
  const tabs = props.tabs === undefined ? props.sidebar?.tabs : props.tabs;

  if (Array.isArray(tabs)) {
    return tabs;
  }
  if (typeof tabs === "object") {
    return getLayoutTabs(tree, tabs);
  }
  if (tabs !== false) {
    return getLayoutTabs(tree);
  }
  return [];
});
// the other props reach the body as they are
const body = computed(() => {
  const { sidebar: { tabs: _defaultTabs, ...sidebarProps } = {}, tabs: _tabs, ...rest } = props;

  return { ...rest, sidebar: sidebarProps };
});
</script>

<template>
  <LayoutBody v-bind="body" :tabs="resolvedTabs">
    <slot />
  </LayoutBody>
</template>
