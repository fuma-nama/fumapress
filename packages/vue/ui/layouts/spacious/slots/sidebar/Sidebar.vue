<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import { SidebarIcon } from "../../../../icons";
import * as Base from "../../../../components/sidebar/base";
import { buttonVariants } from "../../../../components/ui/button";
import { cn } from "../../../../utils/cn";
import { useSpaciousLayout } from "../../context";
import SidebarViewport from "./SidebarViewport.vue";
import TabsMenus from "./TabsMenus.vue";

defineOptions({ inheritAttrs: false });

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
// not rendered when `mode` isn't `full`: the drawer is used instead
const { collapsed, mode } = Base.useSidebar();
const { slots } = useSpaciousLayout();
const className = computed(() =>
  cn(
    "[grid-area:sidebar] flex min-h-0 overflow-clip text-sm md:layout:[--fd-sidebar-width:268px] max-md:hidden",
    // keep a gutter in place of the collapsed sidebar
    collapsed.value && "md:layout:[--fd-sidebar-col:--spacing(2)]",
    props.class,
  ),
);
const panelClass = computed(() =>
  cn(
    "flex flex-col shrink-0 w-(--fd-sidebar-width) transition-[opacity,translate] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
    collapsed.value && "-translate-x-3 opacity-0 rtl:translate-x-3",
  ),
);
const collapseTriggerClass = cn(
  buttonVariants({ variant: "ghost", size: "icon-sm" }),
  "size-8 text-fd-muted-foreground",
);
</script>

<template>
  <aside
    v-if="mode === 'full'"
    id="nd-sidebar"
    :data-collapsed="collapsed"
    :inert="collapsed"
    v-bind="$attrs"
    :class="className"
  >
    <div :class="panelClass">
      <div class="flex items-center gap-2 h-(--fd-header-height) my-2 ps-5.5 pe-3">
        <component
          :is="slots.navTitle"
          class="inline-flex items-center gap-2 min-w-0 me-auto text-[0.9375rem] font-semibold"
        />
        <Base.SidebarCollapseTrigger :class="collapseTriggerClass">
          <SidebarIcon />
        </Base.SidebarCollapseTrigger>
      </div>
      <div class="flex flex-col gap-2 px-3 empty:hidden">
        <TabsMenus />
        <component
          :is="slots.searchTrigger.full"
          v-if="slots.searchTrigger"
          hide-if-disabled
          class="h-10 gap-3 rounded-xl ps-[calc(--spacing(2.5)-1px)] pe-2 [&_svg]:shrink-0"
        />
      </div>
      <SidebarViewport />
    </div>
  </aside>
</template>
