<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import { SidebarIcon } from "../../../../icons";
import { SidebarTrigger } from "../../../../components/sidebar/base";
import { buttonVariants } from "../../../../components/ui/button";
import { cn } from "../../../../utils/cn";
import { useSpaciousLayout } from "../../context";

/** the mobile navbar */
defineOptions({ inheritAttrs: false });

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
const { slots } = useSpaciousLayout();
const className = computed(() =>
  cn(
    "sticky top-(--fd-banner-height,0px) z-30 [grid-area:header] flex items-center h-(--fd-header-height) ps-4 pe-2.5 bg-fd-card md:hidden",
    props.class,
  ),
);
const triggerClass = buttonVariants({ variant: "ghost", size: "icon-sm", className: "p-2" });
</script>

<template>
  <header id="nd-subnav" v-bind="$attrs" :class="className">
    <component
      :is="slots.navTitle"
      class="inline-flex items-center gap-2.5 me-auto font-semibold"
    />
    <component
      :is="slots.searchTrigger.sm"
      v-if="slots.searchTrigger"
      hide-if-disabled
      class="p-2"
    />
    <SidebarTrigger :class="triggerClass">
      <SidebarIcon />
    </SidebarTrigger>
  </header>
</template>
