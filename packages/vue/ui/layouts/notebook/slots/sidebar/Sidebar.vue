<script setup lang="ts">
import { computed, h, type Component, type FunctionalComponent, type HTMLAttributes } from "vue";
import { Languages, SidebarIcon, X } from "../../../../icons";
import * as Base from "../../../../components/sidebar/base";
import { SidebarTabsDropdown } from "../../../../components/sidebar/tabs/dropdown";
import { buttonVariants } from "../../../../components/ui/button";
import { cn } from "../../../../utils/cn";
import { LinkItem, RenderNode, type IconItemType } from "../../../shared";
import { useNotebookLayout } from "../../client";
import type { SidebarProps } from "./index";
import { SidebarLinkItem, SidebarPageTree } from "./renderer";
import SidebarCollapseTrigger from "./SidebarCollapseTrigger.vue";
import SidebarContent from "./SidebarContent.vue";
import SidebarDrawer from "./SidebarDrawer.vue";
import SidebarTrigger from "./SidebarTrigger.vue";

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<SidebarProps>(), { collapsible: true });
const { menuItems, slots, props: layout } = useNotebookLayout();
const navMode = computed(() => layout.value.nav?.mode ?? "auto");
const iconLinks = computed(() =>
  menuItems.value.filter((item): item is IconItemType => item.type === "icon"),
);

type DivAttrs = { class?: HTMLAttributes["class"] };

// a functional component replaces the header and the footer, other nodes are added to them
const RenderHeader: FunctionalComponent<DivAttrs> = (attrs, { slots }) => {
  const banner = props.banner;
  if (typeof banner === "function") return h(banner as Component, attrs, slots);

  return h(
    "div",
    { ...attrs, class: cn("flex flex-col gap-3 p-4 pb-2 empty:hidden", attrs.class) },
    [slots.default?.(), h(RenderNode, { node: banner })],
  );
};
RenderHeader.inheritAttrs = false;

const RenderFooter: FunctionalComponent<DivAttrs> = (attrs, { slots }) => {
  const footer = props.footer;
  if (typeof footer === "function") return h(footer as Component, attrs, slots);

  return h("div", attrs, [slots.default?.(), h(RenderNode, { node: footer })]);
};
RenderFooter.inheritAttrs = false;

const viewport = () =>
  h(Base.SidebarViewport, null, () => [
    menuItems.value
      .filter((item) => item.type !== "icon")
      .map((item, i, arr) =>
        h(SidebarLinkItem, {
          key: i,
          item,
          class: cn("lg:hidden", i === arr.length - 1 && "mb-4"),
        }),
      ),
    h(SidebarPageTree, props.components),
  ]);

const collapseTriggerClass = cn(
  buttonVariants({
    variant: "ghost",
    size: "icon-sm",
    className: "mt-px mb-auto text-fd-muted-foreground",
  }),
);
const tabsClass = computed(() => cn(layout.value.tabMode === "navbar" && "lg:hidden"));
const contentFooterClass = computed(() =>
  cn(
    "hidden flex-row text-fd-muted-foreground items-center border-t px-4 py-2.5",
    iconLinks.value.length > 0 && "max-lg:flex",
  ),
);
const contentIconClass = cn(
  buttonVariants({
    size: "icon-sm",
    variant: "ghost",
    className: "lg:hidden",
  }),
);
const drawerTriggerClass = cn(
  buttonVariants({
    size: "icon-sm",
    variant: "ghost",
    className: "ms-auto text-fd-muted-foreground",
  }),
);
const drawerFooterClass = computed(() =>
  cn(
    "hidden flex-row text-fd-muted-foreground items-center border-t p-4 pt-2 justify-end",
    (slots.value.languageSelect || slots.value.themeSwitch) && "flex",
    iconLinks.value.length > 0 && "max-lg:flex",
  ),
);
const drawerIconClass = (i: number) =>
  cn(
    buttonVariants({
      size: "icon-sm",
      variant: "ghost",
    }),
    "text-fd-muted-foreground lg:hidden",
    i === iconLinks.value.length - 1 && "me-auto",
  );
</script>

<template>
  <SidebarContent v-bind="$attrs">
    <RenderHeader>
      <div v-if="navMode === 'auto'" class="flex justify-between">
        <component
          :is="slots.navTitle"
          v-if="slots.navTitle"
          class="inline-flex items-center gap-2.5 font-medium"
        />
        <RenderNode :node="layout.nav?.children" />
        <SidebarCollapseTrigger v-if="collapsible" :class="collapseTriggerClass">
          <SidebarIcon />
        </SidebarCollapseTrigger>
      </div>
      <SidebarTabsDropdown
        v-if="layout.tabs.length > 0"
        :options="layout.tabs"
        :class="tabsClass"
      />
    </RenderHeader>
    <component :is="viewport" />
    <RenderFooter :class="contentFooterClass">
      <LinkItem
        v-for="(item, i) in iconLinks"
        :key="i"
        :item="item"
        :class="contentIconClass"
        :aria-label="item.label"
      >
        <RenderNode :node="item.icon" />
      </LinkItem>
    </RenderFooter>
  </SidebarContent>
  <SidebarDrawer v-bind="$attrs">
    <RenderHeader>
      <SidebarTrigger :class="drawerTriggerClass">
        <X />
      </SidebarTrigger>
      <SidebarTabsDropdown v-if="layout.tabs.length > 0" :options="layout.tabs" />
    </RenderHeader>
    <component :is="viewport" />
    <RenderFooter :class="drawerFooterClass">
      <LinkItem
        v-for="(item, i) in iconLinks"
        :key="i"
        :item="item"
        :class="drawerIconClass(i)"
        :aria-label="item.label"
      >
        <RenderNode :node="item.icon" />
      </LinkItem>
      <component :is="slots.languageSelect.root" v-if="slots.languageSelect">
        <Languages class="size-4.5 text-fd-muted-foreground" />
      </component>
      <component :is="slots.themeSwitch" v-if="slots.themeSwitch" />
    </RenderFooter>
  </SidebarDrawer>
</template>
