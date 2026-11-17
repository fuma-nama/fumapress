<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  provide,
  shallowRef,
  useTemplateRef,
  type HTMLAttributes,
} from "vue";
import { ChevronDown, Languages } from "../../../../icons";
import {
  NavigationMenuList,
  NavigationMenuRoot,
  NavigationMenuViewport,
} from "@fumapress/vue/reka/navigation-menu";
import { buttonVariants } from "../../../../components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../../../components/ui/collapsible";
import { useTranslations } from "../../../../core/translate";
import { cn } from "../../../../utils/cn";
import { useIsScrollTop } from "../../../../utils/use-is-scroll-top";
import { RenderNode, type LinkItemType } from "../../../shared";
import { useHomeLayout } from "../../index";
import { MobileNavigationMenuKey } from "./context";
import MobileNavigationMenuLinkItem from "./MobileNavigationMenuLinkItem.vue";
import NavigationMenuLinkItem from "./NavigationMenuLinkItem.vue";

defineOptions({ inheritAttrs: false });

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
const { navItems, menuItems, slots, props: layout } = useHomeLayout();
const headerRef = useTemplateRef<HTMLElement>("header");
const open = shallowRef(false);
// the open menu of the navigation menu, empty when closed
const value = shallowRef("");
const setOpen = (v: boolean) => {
  open.value = v;
};
const t = useTranslations({ note: "home layout header" });
const toggleLabel = computed(() => t("Toggle Menu", { note: "aria-label" }));
const nav = computed(() => layout.value.nav);
const transparentMode = computed(() => nav.value?.transparentMode ?? "none");
const isTop = useIsScrollTop({ enabled: () => transparentMode.value === "top" });
const isNavTransparent = computed(() =>
  transparentMode.value === "top" ? (isTop.value ?? true) : transparentMode.value === "always",
);

const onClick = (e: Event) => {
  const element = headerRef.value;
  if (!open.value || !element) return;
  if (element !== e.target && !element.contains(e.target as HTMLElement)) {
    setOpen(false);
  }
};

onMounted(() => {
  window.addEventListener("click", onClick);
});

onBeforeUnmount(() => {
  window.removeEventListener("click", onClick);
});

provide(MobileNavigationMenuKey, { setOpen });

function isSecondary(item: LinkItemType): boolean {
  if ("secondary" in item && item.secondary != null) return item.secondary;

  return item.type === "icon";
}

const mainNavItems = computed(() => navItems.value.filter((item) => !isSecondary(item)));
const secondaryNavItems = computed(() => navItems.value.filter(isSecondary));
const mainMenuItems = computed(() => menuItems.value.filter((item) => !isSecondary(item)));
const secondaryMenuItems = computed(() => menuItems.value.filter(isSecondary));

const headerClass = computed(() => cn("sticky h-14 top-0 z-40", props.class));
const rootClass = computed(() =>
  cn(
    "backdrop-blur-lg border-b transition-[box-shadow,background-color,border-radius]",
    open.value && "max-lg:shadow-lg max-lg:rounded-b-2xl",
    (open.value || !isNavTransparent.value || value.value.length > 0) && "bg-fd-background/80",
  ),
);
const triggerClass = cn(
  buttonVariants({
    size: "icon",
    variant: "ghost",
  }),
);
const chevronClass = computed(() => cn("transition-transform", open.value && "rotate-180"));
const navIconClass = (item: LinkItemType) =>
  cn(item.type === "icon" && "-mx-1 first:ms-0 last:me-0");
const menuIconClass = (item: LinkItemType) => cn(item.type === "icon" && "-mx-1 first:ms-0");
// under the list, where Base UI anchors its positioner
const positionerClass =
  "absolute inset-x-0 top-full mx-auto z-40 box-border max-w-(--fd-layout-width) duration-(--duration) ease-(--easing) empty:hidden before:absolute before:content-[''] data-[side=bottom]:before:top-[-10px] data-[side=bottom]:before:right-0 data-[side=bottom]:before:left-0 data-[side=bottom]:before:h-2.5 data-[side=left]:before:top-0 data-[side=left]:before:right-[-10px] data-[side=left]:before:bottom-0 data-[side=left]:before:w-2.5 data-[side=right]:before:top-0 data-[side=right]:before:bottom-0 data-[side=right]:before:left-[-10px] data-[side=right]:before:w-2.5 data-[side=top]:before:right-0 data-[side=top]:before:bottom-[-10px] data-[side=top]:before:left-0 data-[side=top]:before:h-2.5";
const positionerStyle = {
  "--duration": "0.35s",
  "--easing": "cubic-bezier(0.22, 1, 0.36, 1)",
};
</script>

<template>
  <Collapsible v-model:open="open" as-child>
    <NavigationMenuRoot v-model="value" as-child>
      <header id="nd-nav" ref="header" v-bind="$attrs" :class="headerClass">
        <nav :class="rootClass">
          <NavigationMenuList
            as="div"
            class="flex h-14 w-full mx-auto max-w-(--fd-layout-width) items-center px-4"
          >
            <component
              :is="slots.navTitle"
              v-if="slots.navTitle"
              class="inline-flex items-center gap-2.5 font-semibold"
            />
            <RenderNode :node="nav?.children" />
            <ul class="flex flex-row items-center gap-2 px-6 max-sm:hidden">
              <NavigationMenuLinkItem
                v-for="(item, i) in mainNavItems"
                :key="i"
                :item="item"
                class="text-sm"
              />
            </ul>
            <div class="flex flex-row items-center justify-end gap-1.5 flex-1 max-lg:hidden">
              <component
                :is="slots.searchTrigger.full"
                v-if="slots.searchTrigger"
                :hide-if-disabled="true"
                class="w-full rounded-full ps-2.5 max-w-[240px]"
              />
              <component :is="slots.themeSwitch" v-if="slots.themeSwitch" />
              <component :is="slots.languageSelect.root" v-if="slots.languageSelect">
                <Languages class="size-5" />
              </component>
              <ul class="flex flex-row gap-2 items-center empty:hidden">
                <NavigationMenuLinkItem
                  v-for="(item, i) in secondaryNavItems"
                  :key="i"
                  :class="navIconClass(item)"
                  :item="item"
                />
              </ul>
            </div>
            <div class="flex flex-row items-center ms-auto -me-1.5 lg:hidden">
              <component
                :is="slots.searchTrigger.sm"
                v-if="slots.searchTrigger"
                :hide-if-disabled="true"
                class="p-2"
              />
              <CollapsibleTrigger
                :aria-label="toggleLabel"
                :class="triggerClass"
                @pointerenter="nav?.enableHoverToOpen && setOpen(true)"
              >
                <ChevronDown :class="chevronClass" />
              </CollapsibleTrigger>
            </div>
          </NavigationMenuList>
          <CollapsibleContent class="mx-auto max-w-(--fd-layout-width) lg:hidden">
            <div class="flex flex-col pt-2 p-4 sm:flex-row sm:items-center sm:justify-end">
              <MobileNavigationMenuLinkItem
                v-for="(item, i) in mainMenuItems"
                :key="i"
                :item="item"
                class="sm:hidden"
              />
              <div class="-ms-1.5 flex flex-row items-center gap-2 max-sm:mt-2">
                <MobileNavigationMenuLinkItem
                  v-for="(item, i) in secondaryMenuItems"
                  :key="i"
                  :item="item"
                  :class="menuIconClass(item)"
                />
                <div role="separator" class="flex-1" />
                <component :is="slots.languageSelect.root" v-if="slots.languageSelect">
                  <Languages class="size-5" />
                  <component :is="slots.languageSelect.text" v-if="slots.languageSelect.text" />
                  <ChevronDown class="size-3 text-fd-muted-foreground" />
                </component>
                <component :is="slots.themeSwitch" v-if="slots.themeSwitch" />
              </div>
            </div>
          </CollapsibleContent>
        </nav>
        <div data-side="bottom" :class="positionerClass" :style="positionerStyle">
          <NavigationMenuViewport
            class="relative border h-(--reka-navigation-menu-viewport-height) w-full overflow-hidden rounded-xl bg-fd-popover/80 text-fd-popover-foreground backdrop-blur-md shadow-lg transition-[opacity,width,height] duration-(--duration) ease-(--easing) data-[state=closed]:animate-fd-fade-out data-[state=open]:animate-fd-fade-in"
          />
        </div>
      </header>
    </NavigationMenuRoot>
  </Collapsible>
</template>
