<script setup lang="ts">
import { computed } from "vue";
import { useTranslations } from "../../../core/translate";
import { useSidebar } from "./context";

const { open, setOpen } = useSidebar();
const t = useTranslations({ note: "sidebar" });
const label = computed(() =>
  open.value
    ? t("Close Sidebar", { note: "aria-label" })
    : t("Open Sidebar", { note: "aria-label" }),
);
</script>

<template>
  <button
    type="button"
    :aria-label="label"
    :aria-expanded="open"
    aria-controls="nd-sidebar-mobile"
    @click="setOpen((prev) => !prev)"
  >
    <slot />
  </button>
</template>
