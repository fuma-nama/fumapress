<script setup lang="ts">
import { computed, provide, shallowRef, toRef } from "vue";
import { usePathname } from "../../../core/framework";
import { useMediaQuery } from "../../../core/utils/use-media-query";
import { useOnChange } from "../../../core/utils/use-on-change";
import { useHotKey } from "../../../utils/hotkey";
import { SidebarKey, type Mode } from "./context";
import type { SidebarProviderProps } from "./index";

const props = withDefaults(defineProps<SidebarProviderProps>(), {
  defaultOpenLevel: 0,
  prefetch: undefined,
  collapsible: true,
});
const closeOnRedirect = shallowRef(true);
const open = shallowRef(false);
const collapsed = shallowRef(false);
const pathname = usePathname();
const isDrawer = useMediaQuery("(width < 768px)");
const mode = computed<Mode>(() => (isDrawer.value ? "drawer" : "full"));

const setOpen = (value: boolean | ((prev: boolean) => boolean)) => {
  open.value = typeof value === "function" ? value(open.value) : value;
};
const setCollapsed = (value: boolean | ((prev: boolean) => boolean)) => {
  collapsed.value = typeof value === "function" ? value(collapsed.value) : value;
};

useOnChange(pathname, () => {
  if (closeOnRedirect.value) {
    setOpen(false);
  }
  closeOnRedirect.value = true;
});

useHotKey(
  (e) => {
    if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey || e.key !== "b") return;
    e.preventDefault();
    setCollapsed((prev) => !prev);
  },
  { enabled: () => props.collapsible && mode.value === "full", ignoreTyping: true },
);

useHotKey(
  (e) => {
    if (e.key !== "Escape") return;
    e.preventDefault();
    setOpen(false);
  },
  { enabled: () => open.value && mode.value === "drawer", ignoreTyping: true },
);

provide(SidebarKey, {
  open,
  setOpen,
  collapsed,
  setCollapsed,
  closeOnRedirect,
  defaultOpenLevel: toRef(props, "defaultOpenLevel"),
  prefetch: toRef(props, "prefetch"),
  mode,
});
</script>

<template>
  <slot />
</template>
