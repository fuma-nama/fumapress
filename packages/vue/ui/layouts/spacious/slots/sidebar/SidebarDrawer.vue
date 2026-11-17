<script setup lang="ts">
import { computed } from "vue";
import { LanguagesIcon, MessageCircleIcon, SidebarIcon } from "lucide-vue-next";
import * as Base from "../../../../components/sidebar/base";
import { buttonVariants } from "../../../../components/ui/button";
import { useTranslations } from "../../../../core/translate";
import { cn } from "../../../../utils/cn";
import { LinkItem, RenderNode } from "../../../shared";
import { useSpaciousLayout } from "../../context";
import SidebarViewport from "./SidebarViewport.vue";
import TabsMenus from "./TabsMenus.vue";
import { itemVariants } from "./utils";

const { setOpen } = Base.useSidebar();
const { slots, menuItems, props: layout } = useSpaciousLayout();
const t = useTranslations({ note: "AI chat button" });
const aiChat = computed(() => layout.value.aiChat);
// the icon links and the trigger
const buttonClass = buttonVariants({ variant: "ghost", size: "icon-sm", className: "p-2" });
const aiChatClass = cn(itemVariants(), "hover:bg-fd-accent/60");

function onAskAI() {
  setOpen(false);
  aiChat.value?.onOpenChange(true);
}
</script>

<template>
  <Base.SidebarDrawerOverlay
    class="fixed z-40 inset-0 backdrop-blur-xs data-[state=open]:animate-fd-fade-in data-[state=closed]:animate-fd-fade-out"
  />
  <Base.SidebarDrawerContent
    class="fixed z-40 inset-e-0 inset-y-0 flex flex-col w-[85%] max-w-95 text-[0.9375rem] bg-fd-background border-s shadow-lg data-[state=open]:animate-fd-sidebar-in data-[state=closed]:animate-fd-sidebar-out"
  >
    <div
      class="flex items-center gap-1.5 h-(--fd-header-height) ps-3.5 pe-2.5 text-fd-muted-foreground"
    >
      <div class="flex flex-1">
        <template v-for="(item, i) in menuItems" :key="i">
          <LinkItem
            v-if="item.type === 'icon'"
            :item="item"
            :aria-label="item.label"
            :class="buttonClass"
          >
            <RenderNode :node="item.icon" />
          </LinkItem>
        </template>
      </div>
      <component :is="slots.languageSelect.root" v-if="slots.languageSelect">
        <LanguagesIcon class="size-4.5" />
        <component :is="slots.languageSelect.text" />
      </component>
      <component :is="slots.themeSwitch" v-if="slots.themeSwitch" class="p-0" />
      <Base.SidebarTrigger :class="buttonClass">
        <SidebarIcon />
      </Base.SidebarTrigger>
    </div>
    <div class="flex flex-col gap-2 px-3 empty:hidden">
      <TabsMenus />
      <button v-if="aiChat" type="button" :class="aiChatClass" @click="onAskAI">
        <MessageCircleIcon />{{ t("Ask AI") }}
      </button>
    </div>
    <SidebarViewport />
  </Base.SidebarDrawerContent>
</template>
