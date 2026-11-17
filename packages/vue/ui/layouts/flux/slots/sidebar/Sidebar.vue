<script setup lang="ts">
import { computed } from "vue";
import { cn } from "../../../../utils/cn";
import { useFluxLayout } from "../../context";
import type { SidebarProps } from "./index";
import { SidebarLinkItem, SidebarPageTree } from "./renderer";
import SidebarContent from "./SidebarContent.vue";

defineOptions({ inheritAttrs: false });

defineProps<SidebarProps>();
const { menuItems } = useFluxLayout();
const items = computed(() => menuItems.value.filter((v) => v.type !== "icon"));
const itemClass = (i: number) => cn(i === items.value.length - 1 && "mb-4");
</script>

<template>
  <SidebarContent v-bind="$attrs">
    <div class="flex flex-col gap-3 p-4 pb-2 empty:hidden"><slot name="banner" /></div>
    <div class="flex flex-col p-4">
      <SidebarLinkItem v-for="(item, i) in items" :key="i" :item="item" :class="itemClass(i)" />
      <SidebarPageTree v-bind="components" />
    </div>
    <slot name="footer" />
  </SidebarContent>
</template>
