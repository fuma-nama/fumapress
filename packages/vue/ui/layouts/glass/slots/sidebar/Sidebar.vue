<script setup lang="ts">
import { computed, shallowRef, type HTMLAttributes } from "vue";
import {
  ScrollAreaCorner,
  ScrollAreaRoot,
  ScrollAreaScrollbar,
  ScrollAreaThumb,
  ScrollAreaViewport,
} from "@fumapress/vue/reka/scroll-area";
import { SidebarIcon } from "../../../../icons";
import { buttonVariants } from "../../../../components/ui/button";
import { useTreeContext } from "../../../../contexts/tree";
import { useTranslations } from "../../../../core/translate";
import { cn } from "../../../../utils/cn";
import { useGlassLayout } from "../..";
import { LayoutTabsDropdown } from "../../layout-tabs";
import { useSidebar } from "./context";
import SidebarIconLinkItem from "./SidebarIconLinkItem.vue";
import SidebarLinkItem from "./SidebarLinkItem.vue";
import SidebarNode from "./SidebarNode.vue";

defineOptions({ inheritAttrs: false });

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
const { menuItems, props: layout, slots } = useGlassLayout();
const { root } = useTreeContext();
const { collapsible, collapsed, setCollapsed } = useSidebar();
const t = useTranslations({ note: "sidebar" });
// the `hovering` state of Base UI's scroll area: the scrollbar of Reka UI has no state for it
const hovering = shallowRef(false);

const className = computed(() =>
  cn(
    "sticky flex flex-col transition-transform [grid-area:left] my-2 ms-2 z-30 top-2 border rounded-2xl bg-fd-popover/80 text-fd-popover-foreground text-sm backdrop-blur-sm shadow-sm h-[calc(100dvh---spacing(4))] max-md:hidden md:layout:[--fd-left-width:280px]",
    collapsed.value &&
      "w-[calc(280px---spacing(2))] -translate-x-[280px] md:layout:[--fd-left-width:0px]",
    props.class,
  ),
);
const collapseClass = cn(
  buttonVariants({ variant: "ghost", size: "icon-sm" }),
  "text-fd-muted-foreground",
);
const scrollbarClass = computed(() =>
  cn("flex h-full w-1.5 select-none transition-opacity", !hovering.value && "opacity-0"),
);

function onPointerEnterOrMove(e: PointerEvent) {
  if (e.pointerType !== "touch") hovering.value = true;
}
</script>

<template>
  <aside id="nd-sidebar" :class="className" v-bind="$attrs">
    <div class="flex items-start gap-1 pt-4 ps-4.5 pe-3.5 empty:hidden">
      <component
        :is="slots.navTitle"
        class="flex text-sm items-center font-semibold gap-2 me-auto"
      />
      <div class="flex -mt-1.5 -me-1.5 empty:hidden">
        <template v-for="(item, i) in menuItems" :key="i">
          <SidebarIconLinkItem v-if="item.type === 'icon'" :item="item" />
        </template>
        <button
          v-if="collapsible"
          :aria-label="collapsed ? t('Show Sidebar') : t('Hide Sidebar')"
          :class="collapseClass"
          @click="setCollapsed(!collapsed)"
        >
          <SidebarIcon />
        </button>
      </div>
    </div>
    <LayoutTabsDropdown
      v-if="layout.tabs.length > 0"
      :tabs="layout.tabs"
      class="min-w-0 bg-fd-secondary text-fd-secondary-foreground rounded-xl px-2.5 py-2 [&_svg]:size-4 border rounded-xl shadow-sm mx-2 mt-2.5 empty:hidden"
    />
    <ScrollAreaRoot
      type="auto"
      class="min-h-0 flex-1"
      @pointerenter="onPointerEnterOrMove"
      @pointermove="onPointerEnterOrMove"
      @pointerleave="hovering = false"
    >
      <ScrollAreaViewport
        as-child
        class="size-full rounded-[inherit] p-2 [mask-image:linear-gradient(to_bottom,transparent,white_16px,white_calc(100%-16px),transparent))]"
      >
        <div class="flex flex-col">
          <template v-for="(item, i) in menuItems" :key="i">
            <SidebarLinkItem v-if="item.type !== 'icon'" :item="item" />
          </template>
          <SidebarNode v-for="(item, i) in root.children" :key="i" :node="item" />
        </div>
      </ScrollAreaViewport>
      <ScrollAreaCorner />
      <ScrollAreaScrollbar :class="scrollbarClass">
        <ScrollAreaThumb class="relative flex-1 rounded-full bg-fd-border" />
      </ScrollAreaScrollbar>
    </ScrollAreaRoot>
    <slot />
  </aside>
</template>
