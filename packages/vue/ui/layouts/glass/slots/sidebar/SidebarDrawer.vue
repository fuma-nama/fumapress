<script setup lang="ts">
import { computed } from "vue";
import { ChevronsUpDown, LanguagesIcon, MessageCircleIcon, XIcon } from "lucide-vue-next";
import * as Drawer from "../../../../primitives/drawer";
import { buttonVariants } from "../../../../components/ui/button";
import { useTreeContext } from "../../../../contexts/tree";
import { useTranslations } from "../../../../core/translate";
import { cn } from "../../../../utils/cn";
import { useGlassLayout } from "../..";
import { drawerHandle } from "./context";
import type { SidebarDrawerProps } from "./index";
import SidebarIconLinkItem from "./SidebarIconLinkItem.vue";
import SidebarLinkItem from "./SidebarLinkItem.vue";
import SidebarNode from "./SidebarNode.vue";

const props = defineProps<SidebarDrawerProps>();
const { menuItems, props: layout, slots } = useGlassLayout();
const { root } = useTreeContext();
const t = useTranslations();

const popupClass = cn(
  "relative [--bleed:3rem] supports-[-webkit-touch-callout:none]:[--bleed:0px] w-[360px] h-full max-w-[calc(100vw-3rem+var(--bleed))] pr-(--bleed) -mr-(--bleed) border-l bg-fd-background text-fd-foreground text-[0.9375rem] outline-none shadow-md touch-auto [transform:translateX(var(--drawer-swipe-movement-x))] transition-transform duration-450 ease-[cubic-bezier(0.32,0.72,0,1)] data-swiping:select-none data-ending-style:[transform:translateX(calc(100%-var(--bleed)+var(--viewport-padding)+2px))] data-starting-style:[transform:translateX(calc(100%-var(--bleed)+var(--viewport-padding)+2px))] supports-[-webkit-touch-callout:none]:border supports-[-webkit-touch-callout:none]:rounded-xl",

  // this could be a bug or deliberate, but scrolling in drawer content will somehow get interrupted on IOS, the reason is unknown but this is the simplest workaround
  // scrollbar-width should be zero because the scrollbar is in fact behind the viewport: | content | bleed | scroll bar |, it will push the content to left if not
  "[scrollbar-width:none] overflow-y-auto",
);
const content = computed(() => ({
  ...props.contentProps,
  class: cn("flex flex-col min-h-full px-3", props.contentProps?.class),
}));
const aiChatClass = cn(
  buttonVariants({ variant: "secondary", size: "sm" }),
  "rounded-full h-8 gap-1.5",
);
const closeClass = cn(buttonVariants({ variant: "secondary", size: "icon-sm" }), "rounded-full");
const closeSidebarLabel = computed(() => t("Close Sidebar", { note: "aria-label" }));

function onAIChatClick() {
  const aiChat = layout.value.aiChat;
  if (!aiChat) return;
  aiChat.onOpenChange(!aiChat.open);
  drawerHandle.close();
}
</script>

<template>
  <Drawer.Root :handle="drawerHandle" swipe-direction="right">
    <Drawer.Portal class="z-40">
      <Drawer.Backdrop
        class="[--bleed:3rem] fixed inset-0 min-h-dvh bg-fd-overlay backdrop-blur-sm opacity-[calc(1-var(--drawer-swipe-progress))] transition-opacity duration-450 ease-[cubic-bezier(0.32,0.72,0,1)] data-swiping:duration-0 data-ending-style:opacity-0 data-starting-style:opacity-0 data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] supports-[-webkit-touch-callout:none]:absolute"
      />
      <Drawer.Viewport
        class="[--viewport-padding:0px] supports-[-webkit-touch-callout:none]:[--viewport-padding:0.625rem] fixed inset-0 flex items-stretch justify-end p-(--viewport-padding)"
      >
        <Drawer.Popup id="nd-mobile-sidebar" :class="popupClass">
          <Drawer.Content v-bind="content">
            <div
              class="sticky flex flex-col gap-2 top-0 pt-4 pb-2 bg-fd-background shadow-lg shadow-fd-background"
            >
              <div class="flex items-center gap-1.5 ps-2.5">
                <Drawer.Title
                  :as="slots.navTitle"
                  class="flex items-center font-semibold gap-2 flex-1"
                />
                <button v-if="layout.aiChat" :class="aiChatClass" @click="onAIChatClick">
                  <MessageCircleIcon class="size-4 text-fd-muted-foreground" />
                  {{ t("Ask AI", { note: "AI chat button" }) }}
                </button>
                <Drawer.Close :aria-label="closeSidebarLabel" :class="closeClass">
                  <XIcon />
                </Drawer.Close>
              </div>
              <component
                :is="slots.languageSelect.root"
                v-if="slots.languageSelect"
                variant="secondary"
                class="px-2.5 gap-2 rounded-lg"
              >
                <LanguagesIcon class="size-4 text-fd-muted-foreground shrink-0" />
                <component :is="slots.languageSelect.text" />
                <ChevronsUpDown class="ms-auto size-3.5 text-fd-muted-foreground shrink-0" />
              </component>
            </div>
            <div class="flex flex-col py-2 flex-1">
              <template v-for="(item, i) in menuItems" :key="i">
                <SidebarLinkItem v-if="item.type !== 'icon'" :item="item" />
              </template>
              <SidebarNode v-for="(item, i) in root.children" :key="i" :node="item" />
            </div>
            <div
              class="flex items-center sticky bottom-0 bg-fd-background px-1 pt-2 pb-4 border-t mt-2 empty:hidden"
            >
              <template v-for="(item, i) in menuItems" :key="i">
                <SidebarIconLinkItem v-if="item.type === 'icon'" :item="item" />
              </template>
              <component :is="slots.themeSwitch" v-if="slots.themeSwitch" class="p-0 ms-auto" />
            </div>
          </Drawer.Content>
        </Drawer.Popup>
      </Drawer.Viewport>
    </Drawer.Portal>
  </Drawer.Root>
</template>
