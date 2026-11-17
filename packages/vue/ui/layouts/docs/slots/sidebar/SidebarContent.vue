<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { SidebarIcon } from "lucide-vue-next";
import * as Base from "../../../../components/sidebar/base";
import { buttonVariants } from "../../../../components/ui/button";
import { cn } from "../../../../utils/cn";
import { SearchTrigger } from "../../../shared/slots/search-trigger";

defineOptions({ inheritAttrs: false });

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
let element: HTMLElement | null = null;

function setRef(el: unknown, asideRef: Base.SidebarContentState["ref"]) {
  element = el instanceof HTMLElement ? el : null;
  asideRef(element);
}

// called while rendering: the element still has the attributes of the last render
function asideClass(collapsed: boolean, hovered: boolean) {
  return cn(
    "absolute flex flex-col w-full inset-s-0 inset-y-0 items-end bg-fd-card text-sm border-e duration-250 *:w-(--fd-sidebar-width)",
    collapsed && [
      "inset-y-2 rounded-xl transition-transform border w-(--fd-sidebar-width)",
      hovered
        ? "shadow-lg translate-x-2 rtl:-translate-x-2"
        : "-translate-x-(--fd-sidebar-width) rtl:translate-x-full",
    ],
    element &&
      (element.getAttribute("data-collapsed") === "true") !== collapsed &&
      "transition-[width,inset-block,translate,background-color]",
    props.class,
  );
}

function panelClass(collapsed: boolean, hovered: boolean) {
  return cn(
    "fixed flex top-[calc(--spacing(4)+var(--fd-docs-row-3))] inset-s-4 shadow-lg transition-opacity rounded-xl p-0.5 border bg-fd-muted text-fd-muted-foreground z-10",
    (!collapsed || hovered) && "pointer-events-none opacity-0",
  );
}

const collapseTriggerClass = cn(
  buttonVariants({
    variant: "ghost",
    size: "icon-sm",
    className: "rounded-lg",
  }),
);
</script>

<template>
  <Base.SidebarContent v-slot="{ collapsed, hovered, ref: asideRef, ...rest }">
    <div
      data-sidebar-placeholder=""
      class="sticky top-(--fd-docs-row-1) z-20 [grid-area:sidebar] pointer-events-none *:pointer-events-auto h-[calc(var(--fd-docs-height)-var(--fd-docs-row-1))] md:layout:[--fd-sidebar-width:268px] max-md:hidden"
    >
      <div v-if="collapsed" class="absolute inset-s-0 inset-y-0 w-4" v-bind="rest" />
      <aside
        id="nd-sidebar"
        :ref="(el) => setRef(el, asideRef)"
        :data-collapsed="collapsed"
        :data-hovered="collapsed && hovered"
        :inert="collapsed && !hovered"
        :class="asideClass(collapsed, hovered)"
        v-bind="{ ...$attrs, ...rest }"
      >
        <slot />
      </aside>
    </div>
    <div
      data-sidebar-panel=""
      :class="panelClass(collapsed, hovered)"
      :inert="!collapsed || hovered"
    >
      <Base.SidebarCollapseTrigger :class="collapseTriggerClass">
        <SidebarIcon />
      </Base.SidebarCollapseTrigger>
      <SearchTrigger class="rounded-lg" hide-if-disabled />
    </div>
  </Base.SidebarContent>
</template>
