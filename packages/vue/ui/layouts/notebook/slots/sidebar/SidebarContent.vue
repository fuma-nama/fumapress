<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import * as Base from "../../../../components/sidebar/base";
import { cn } from "../../../../utils/cn";
import { useNotebookLayout } from "../../client";

defineOptions({ inheritAttrs: false });

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
const { props: layout } = useNotebookLayout();
const navMode = computed(() => layout.value.nav?.mode ?? "auto");
let element: HTMLElement | null = null;

function setRef(el: unknown, asideRef: Base.SidebarContentState["ref"]) {
  element = el instanceof HTMLElement ? el : null;
  asideRef(element);
}

const placeholderClass = computed(() =>
  cn(
    "sticky z-20 [grid-area:sidebar] pointer-events-none *:pointer-events-auto md:layout:[--fd-sidebar-width:268px] max-md:hidden",
    navMode.value === "auto"
      ? "top-(--fd-docs-row-1) h-[calc(var(--fd-docs-height)-var(--fd-docs-row-1))]"
      : "top-(--fd-docs-row-2) h-[calc(var(--fd-docs-height)-var(--fd-docs-row-2))]",
  ),
);

// called while rendering: the element still has the attributes of the last render
function asideClass(collapsed: boolean, hovered: boolean) {
  return cn(
    "absolute flex flex-col w-full start-0 inset-y-0 items-end text-sm duration-250 *:w-(--fd-sidebar-width)",
    navMode.value === "auto" && "bg-fd-card border-e",
    collapsed && [
      "inset-y-2 rounded-xl bg-fd-card transition-transform border w-(--fd-sidebar-width)",
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
</script>

<template>
  <Base.SidebarContent v-slot="{ collapsed, hovered, ref: asideRef, ...rest }">
    <div data-sidebar-placeholder="" :class="placeholderClass">
      <div v-if="collapsed" class="absolute start-0 inset-y-0 w-4" v-bind="rest" />
      <aside
        id="nd-sidebar"
        :ref="(el) => setRef(el, asideRef)"
        :data-collapsed="collapsed"
        :data-hovered="collapsed && hovered"
        :class="asideClass(collapsed, hovered)"
        v-bind="{ ...$attrs, ...rest }"
      >
        <slot />
      </aside>
    </div>
  </Base.SidebarContent>
</template>
