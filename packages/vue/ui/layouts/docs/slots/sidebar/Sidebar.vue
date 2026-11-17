<script setup lang="ts">
import { computed, h } from "vue";
import { ChevronDown, Languages, SidebarIcon } from "lucide-vue-next";
import * as Base from "../../../../components/sidebar/base";
import { SidebarTabsDropdown } from "../../../../components/sidebar/tabs/dropdown";
import { buttonVariants } from "../../../../components/ui/button";
import { cn } from "../../../../utils/cn";
import { LinkItem, RenderNode, type IconItemType } from "../../../shared";
import { useDocsLayout } from "../../client";
import type { SidebarProps } from "./index";
import { SidebarLinkItem, SidebarPageTree } from "./renderer";
import SidebarCollapseTrigger from "./SidebarCollapseTrigger.vue";
import SidebarContent from "./SidebarContent.vue";
import SidebarDrawer from "./SidebarDrawer.vue";
import SidebarTrigger from "./SidebarTrigger.vue";

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<SidebarProps>(), { collapsible: true });
const { menuItems, slots, props: layout } = useDocsLayout();
const iconLinks = computed(() =>
  menuItems.value.filter((item): item is IconItemType => item.type === "icon"),
);
// the options of the dropdown on desktop
const tabOptions = computed(() => {
  const { tabs, tabMode } = layout.value;

  return tabMode === "auto" ? tabs : tabs.filter((tab) => typeof tab.$folder?.root === "string");
});

const viewport = () =>
  h(Base.SidebarViewport, null, () => [
    menuItems.value
      .filter((v) => v.type !== "icon")
      .map((item, i, list) =>
        h(SidebarLinkItem, { key: i, item, class: cn(i === list.length - 1 && "mb-4") }),
      ),
    h(SidebarPageTree, props.components),
  ]);

const collapseTriggerClass = cn(
  buttonVariants({
    variant: "ghost",
    size: "icon-sm",
    className: "mb-auto text-fd-muted-foreground",
  }),
);
const iconLinkClass = cn(buttonVariants({ size: "icon-sm", variant: "ghost" }));
const drawerButtonClass = cn(
  buttonVariants({
    variant: "ghost",
    size: "icon-sm",
    className: "p-2",
  }),
);
</script>

<template>
  <SidebarContent v-bind="$attrs">
    <div class="flex flex-col gap-3 p-4 pb-2">
      <div class="flex">
        <component
          :is="slots.navTitle"
          v-if="slots.navTitle"
          class="inline-flex text-[0.9375rem] items-center gap-2.5 font-medium me-auto"
        />
        <RenderNode :node="layout.nav?.children" />
        <SidebarCollapseTrigger v-if="collapsible" :class="collapseTriggerClass">
          <SidebarIcon />
        </SidebarCollapseTrigger>
      </div>
      <component :is="slots.searchTrigger.full" v-if="slots.searchTrigger" hide-if-disabled />
      <SidebarTabsDropdown v-if="layout.tabs.length > 0" :options="tabOptions" />
      <slot name="banner" />
    </div>
    <component :is="viewport" />
    <div
      v-if="slots.languageSelect || iconLinks.length > 0 || slots.themeSwitch || $slots.footer"
      class="flex flex-col p-4 pt-2"
    >
      <component
        :is="slots.languageSelect.root"
        v-if="slots.languageSelect"
        variant="secondary"
        class="text-fd-muted-foreground text-start justify-start bg-fd-secondary/50 mb-2"
      >
        <Languages class="size-4.5" />
        <component :is="slots.languageSelect.text" />
        <ChevronDown class="ms-auto size-3.5" />
      </component>
      <div
        class="flex text-fd-muted-foreground items-center border bg-fd-secondary/50 p-0.5 pe-0 rounded-lg empty:hidden"
      >
        <LinkItem
          v-for="(item, i) in iconLinks"
          :key="i"
          :item="item"
          :class="iconLinkClass"
          :aria-label="item.label"
        >
          <RenderNode :node="item.icon" />
        </LinkItem>
        <component
          :is="slots.themeSwitch"
          v-if="slots.themeSwitch"
          class="px-1 py-0 border-y-0 border-e-0 rounded-none ms-auto *:rounded-md"
        />
      </div>
      <slot name="footer" />
    </div>
  </SidebarContent>
  <SidebarDrawer>
    <div class="flex flex-col gap-3 p-4 pb-2">
      <div class="flex text-fd-muted-foreground items-center gap-1.5">
        <div class="flex flex-1">
          <LinkItem
            v-for="(item, i) in iconLinks"
            :key="i"
            :item="item"
            :class="drawerButtonClass"
            :aria-label="item.label"
          >
            <RenderNode :node="item.icon" />
          </LinkItem>
        </div>
        <component :is="slots.languageSelect.root" v-if="slots.languageSelect">
          <Languages class="size-4.5" />
          <component :is="slots.languageSelect.text" />
        </component>
        <component :is="slots.themeSwitch" v-if="slots.themeSwitch" class="p-0" />
        <SidebarTrigger :class="drawerButtonClass">
          <SidebarIcon />
        </SidebarTrigger>
      </div>
      <SidebarTabsDropdown v-if="layout.tabs.length > 0" :options="layout.tabs" />
      <slot name="banner" />
    </div>
    <component :is="viewport" />
    <div class="flex flex-col border-t p-4 pt-2 empty:hidden"><slot name="footer" /></div>
  </SidebarDrawer>
</template>
