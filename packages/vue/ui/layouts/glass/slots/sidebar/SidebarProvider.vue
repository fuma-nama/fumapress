<script setup lang="ts">
import { provide, shallowRef, toRef } from "vue";
import { useHotKey } from "../../../../utils/hotkey";
import { SidebarKey } from "./context";
import type { SidebarProviderProps } from "./index";

const props = withDefaults(defineProps<SidebarProviderProps>(), { collapsible: true });
const collapsed = shallowRef(false);

useHotKey(
  (e) => {
    if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey || e.key !== "b") return;
    e.preventDefault();
    collapsed.value = !collapsed.value;
  },
  { enabled: () => props.collapsible, ignoreTyping: true },
);

provide(SidebarKey, {
  collapsible: toRef(props, "collapsible"),
  collapsed,
  setCollapsed: (v) => {
    collapsed.value = v;
  },
});
</script>

<template>
  <slot />
</template>
