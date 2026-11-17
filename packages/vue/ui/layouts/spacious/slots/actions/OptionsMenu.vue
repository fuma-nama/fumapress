<script setup lang="ts">
import { computed } from "vue";
import { ArrowUpRightIcon, EllipsisIcon, MessageCircleIcon, SunMoonIcon } from "../../../../icons";
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger,
} from "@fumapress/vue/reka/dropdown-menu";
import { buttonVariants } from "../../../../components/ui/button";
import { Link } from "../../../../core/link";
import { useTranslations } from "../../../../core/translate";
import { cn } from "../../../../utils/cn";
import { RenderNode, type IconItemType } from "../../../shared";
import { useSpaciousLayout } from "../../context";
import Languages from "./Languages.vue";
import ThemeSegments from "./ThemeSegments.vue";
import { itemClass, popupClass } from "./utils";

const { props: layout, slots, menuItems } = useSpaciousLayout();
const t = useTranslations();
const aiChat = computed(() => layout.value.aiChat);
const iconLinks = computed(() =>
  menuItems.value.filter((item): item is IconItemType => item.type === "icon"),
);
const enabled = computed(
  () =>
    !!aiChat.value ||
    !!slots.value.themeSwitch ||
    !!slots.value.languageSelect ||
    iconLinks.value.length > 0,
);
const triggerClass = computed(() =>
  cn(
    buttonVariants({ variant: "ghost", size: "icon-sm" }),
    "text-fd-muted-foreground data-[state=open]:bg-fd-accent data-[state=open]:text-fd-accent-foreground",
    // only the theme options remain on wider viewports
    !slots.value.themeSwitch && "lg:hidden",
  ),
);
// the class of Base UI's positioner is on the content: Reka UI gives its wrapper the z-index of the content
const contentClass = cn("z-50", popupClass, "w-64 *:not-first:border-t");
const aiChatClass = cn(itemClass, "lg:hidden");
</script>

<template>
  <DropdownMenuRoot v-if="enabled">
    <DropdownMenuTrigger :aria-label="t('Options', { note: 'aria-label' })" :class="triggerClass">
      <EllipsisIcon />
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        align="end"
        :side-offset="8"
        position-strategy="fixed"
        :class="contentClass"
      >
        <div v-if="aiChat || slots.themeSwitch" class="flex flex-col p-1">
          <DropdownMenuItem
            v-if="aiChat"
            :class="aiChatClass"
            @select="aiChat.onOpenChange(!aiChat.open)"
          >
            <MessageCircleIcon class="text-fd-muted-foreground" />{{
              t("Ask AI", { note: "AI chat button" })
            }}
          </DropdownMenuItem>
          <div v-if="slots.themeSwitch" class="flex items-center gap-3 py-1 ps-2.5 pe-1">
            <SunMoonIcon class="size-4 text-fd-muted-foreground" />
            <span aria-hidden="true" class="flex-1">{{ t("Theme", { note: "site menu" }) }}</span>
            <ThemeSegments />
          </div>
        </div>
        <Languages v-if="slots.languageSelect" class="lg:hidden" />
        <div v-if="iconLinks.length > 0" class="flex flex-col p-1 lg:hidden">
          <DropdownMenuItem v-for="(item, i) in iconLinks" :key="i" as-child :class="itemClass">
            <Link :href="item.url" :external="item.external">
              <span class="flex items-center justify-center size-4">
                <RenderNode :node="item.icon" />
              </span>
              <span class="flex-1"><RenderNode :node="item.text" /></span>
              <ArrowUpRightIcon v-if="item.external" class="text-fd-muted-foreground" />
            </Link>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
