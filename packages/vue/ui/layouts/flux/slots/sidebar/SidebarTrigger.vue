<script setup lang="ts">
import { computed } from "vue";
import { SidebarIcon, XIcon } from "lucide-vue-next";
import { AnimatePresence, motion } from "motion-v";
import * as Base from "../../../../components/sidebar/base";
import { useTranslations } from "../../../../core/translate";

const { open, setOpen } = Base.useSidebar();
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
    aria-controls="nd-sidebar"
    @click="setOpen((prev) => !prev)"
  >
    <AnimatePresence mode="wait">
      <motion.span
        :key="open ? 'open' : 'closed'"
        :transition="{ duration: 0.2 }"
        :initial="{
          y: '100%',
          opacity: 0,
        }"
        :animate="{
          y: 0,
          opacity: 1,
        }"
        :exit="{
          y: '100%',
          opacity: 0,
        }"
      >
        <XIcon v-if="open" />
        <SidebarIcon v-else />
      </motion.span>
    </AnimatePresence>
  </button>
</template>
