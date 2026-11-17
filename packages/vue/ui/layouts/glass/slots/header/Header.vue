<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import { ChevronsUpDown, LanguagesIcon, MessageCircleIcon, SidebarIcon } from "lucide-vue-next";
import * as Drawer from "../../../../primitives/drawer";
import { buttonVariants } from "../../../../components/ui/button";
import { useTranslations } from "../../../../core/translate";
import { cn } from "../../../../utils/cn";
import { useGlassLayout } from "../..";
import { LayoutTabsDropdown } from "../../layout-tabs";

defineOptions({ inheritAttrs: false });

const props = defineProps<{ class?: HTMLAttributes["class"] }>();

const baseVariants =
  "rounded-full bg-fd-popover/80 text-fd-popover-foreground border backdrop-blur-sm shadow-sm";

const { props: layout, slots } = useGlassLayout();
const t = useTranslations();
const { collapsible, collapsed, setCollapsed } = slots.value.sidebar.use();

const className = computed(() =>
  cn(
    "sticky flex flex-row justify-end gap-2 [grid-area:left-margin/left-margin/right/right] z-20 px-4 md:top-0 md:pt-2 md:px-2 md:h-(--fd-header-height) md:layout:[--fd-header-height:--spacing(12)] md:bg-linear-to-b md:from-fd-background max-md:bottom-0 max-md:mt-auto max-md:h-16 max-md:pb-4 max-md:bg-linear-to-t max-md:from-fd-background",
    props.class,
  ),
);
const showSidebarClass = cn(
  buttonVariants({ size: "icon-sm", variant: "secondary" }),
  baseVariants,
  "size-10 me-auto shrink-0 max-md:hidden",
);
const searchTriggerClass = cn(baseVariants, "size-12 shrink-0 md:hidden");
const tabsClass = cn(baseVariants, "min-w-0 ps-4 pe-3 flex-1 [&_svg]:size-5 md:hidden");
const fullSearchTriggerClass = cn(
  baseVariants,
  "text-fd-muted-foreground ps-3 w-full @sm:max-w-[200px]",
);
const aiChatClass = cn(
  buttonVariants({ variant: "secondary" }),
  baseVariants,
  "px-3 gap-2 text-fd-muted-foreground shrink-0 max-md:hidden",
);
const languageSelectClass = cn(baseVariants, "px-3 rounded-full max-md:hidden");
const themeSwitchClass = cn(baseVariants, "shrink-0 px-1.5 max-md:hidden");
const closeSidebarLabel = computed(() => t("Close Sidebar", { note: "aria-label" }));
const openSidebarLabel = computed(() => t("Open Sidebar", { note: "aria-label" }));
const sidebarTriggerClass = cn(
  buttonVariants({ variant: "secondary", size: "icon" }),
  baseVariants,
  "shrink-0 size-12 md:hidden",
);
</script>

<template>
  <div :class="className" v-bind="$attrs">
    <button
      v-if="collapsible && collapsed"
      :aria-label="t('Show Sidebar', { note: 'sidebar' })"
      :class="showSidebarClass"
      @click="setCollapsed(false)"
    >
      <SidebarIcon />
    </button>
    <component
      :is="slots.searchTrigger.sm"
      v-if="slots.searchTrigger"
      variant="secondary"
      size="icon"
      :class="searchTriggerClass"
    />
    <LayoutTabsDropdown
      v-if="layout.tabs.length > 0"
      :tabs="layout.tabs"
      size="lg"
      :class="tabsClass"
    />
    <div v-if="slots.searchTrigger" class="@container flex justify-end flex-1 max-md:hidden">
      <component :is="slots.searchTrigger.full" :class="fullSearchTriggerClass" />
    </div>
    <button
      v-if="layout.aiChat && !layout.aiChat.open"
      :class="aiChatClass"
      @click="layout.aiChat.onOpenChange(true)"
    >
      <MessageCircleIcon class="size-4" />
      {{ t("Ask AI", { note: "AI chat button" }) }}
    </button>
    <component
      :is="slots.languageSelect.root"
      v-if="slots.languageSelect"
      :class="languageSelectClass"
    >
      <LanguagesIcon class="size-4 text-fd-muted-foreground shrink-0" />
      <component :is="slots.languageSelect.text" />
      <ChevronsUpDown class="size-3.5 text-fd-muted-foreground shrink-0" />
    </component>
    <component :is="slots.themeSwitch" v-if="slots.themeSwitch" :class="themeSwitchClass" />
    <Drawer.Trigger v-slot="{ open }" :handle="slots.sidebar.drawerHandle" as-child>
      <button
        :class="sidebarTriggerClass"
        :aria-label="open ? closeSidebarLabel : openSidebarLabel"
      >
        <SidebarIcon />
      </button>
    </Drawer.Trigger>
  </div>
</template>
