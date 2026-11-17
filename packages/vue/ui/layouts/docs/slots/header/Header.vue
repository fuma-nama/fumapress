<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import { SidebarIcon } from "../../../../icons";
import { buttonVariants } from "../../../../components/ui/button";
import { cn } from "../../../../utils/cn";
import { RenderNode } from "../../../shared";
import { useDocsLayout } from "../../client";

defineOptions({ inheritAttrs: false });

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
const { isNavTransparent, slots, props: layout } = useDocsLayout();
const nav = computed(() => layout.value.nav);
const className = computed(() =>
  cn(
    "[grid-area:header] sticky top-(--fd-docs-row-1) z-30 flex items-center ps-4 pe-2.5 border-b transition-colors backdrop-blur-sm h-(--fd-header-height) md:hidden max-md:layout:[--fd-header-height:--spacing(14)] data-[transparent=false]:bg-fd-background/80",
    props.class,
  ),
);
const triggerClass = cn(
  buttonVariants({
    variant: "ghost",
    size: "icon-sm",
    className: "p-2",
  }),
);
</script>

<template>
  <RenderNode v-if="nav?.component" :node="nav.component" />
  <header
    v-else
    id="nd-subnav"
    :data-transparent="isNavTransparent"
    v-bind="$attrs"
    :class="className"
  >
    <component
      :is="slots.navTitle"
      v-if="slots.navTitle"
      class="inline-flex items-center gap-2.5 font-semibold"
    />
    <div class="flex-1"><RenderNode :node="nav?.children" /></div>
    <component
      :is="slots.searchTrigger.sm"
      v-if="slots.searchTrigger"
      hide-if-disabled
      class="p-2"
    />
    <component :is="slots.sidebar.trigger" v-if="slots.sidebar" :class="triggerClass">
      <SidebarIcon />
    </component>
  </header>
</template>
