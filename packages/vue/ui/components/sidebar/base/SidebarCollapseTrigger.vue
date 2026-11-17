<script setup lang="ts">
import { computed, nextTick } from "vue";
import { useTranslations } from "../../../core/translate";
import { useSidebar } from "./context";

const { collapsed, setCollapsed } = useSidebar();
const t = useTranslations({ note: "sidebar" });
const label = computed(() => t("Collapse Sidebar", { note: "aria-label" }));

async function onClick(e: MouseEvent) {
  const button = e.currentTarget as HTMLElement;
  setCollapsed((prev) => !prev);
  await nextTick();
  // hand focus to the visible trigger if this one became hidden
  if (button.matches("[inert] *"))
    document.querySelector<HTMLElement>('[aria-controls="nd-sidebar"]:not([inert] *)')?.focus();
}
</script>

<template>
  <button
    type="button"
    :aria-label="label"
    aria-controls="nd-sidebar"
    :aria-expanded="!collapsed"
    :data-collapsed="collapsed"
    @click="onClick"
  >
    <slot />
  </button>
</template>
