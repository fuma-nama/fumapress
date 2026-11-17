<script setup lang="ts">
import { computed } from "vue";
import { CheckIcon, ChevronsUpDownIcon } from "lucide-vue-next";
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger,
} from "reka-ui";
import { useTreePath } from "../../../../contexts/tree";
import { usePathname } from "../../../../core/framework";
import { Link } from "../../../../core/link";
import { useTranslations } from "../../../../core/translate";
import { cn } from "../../../../utils/cn";
import { isLayoutTabActive, RenderNode, type LayoutTab } from "../../../shared";
import TabIcon from "./TabIcon.vue";

const props = defineProps<{ options: LayoutTab[] }>();
const t = useTranslations();
const pathname = usePathname();
const path = useTreePath();
const selected = computed(() =>
  props.options.findLast((tab) => isLayoutTabActive(tab, path.value, pathname.value)),
);
const titleClass = computed(() =>
  cn("flex-1 truncate", !selected.value && "text-fd-muted-foreground"),
);
// The class of Base UI's positioner (`z-50`) is on the content: Reka UI gives its wrapper the z-index of the content.
// Its popup transitions from `data-starting-style` to `data-ending-style`, Reka UI waits for a CSS animation before it
// unmounts the content: the start is `@starting-style`, the end an animation of the closed state.

// the link is the item: the class of Base UI's `Menu.LinkItem` is on it
const linkProps = (tab: LayoutTab) => ({
  href: tab.url,
  ...tab.props,
  class: cn(
    "flex w-full min-h-9 items-start gap-3 rounded-lg px-[calc(--spacing(2.5)-1px)] py-2 text-start outline-none transition-colors duration-100 data-highlighted:bg-fd-accent data-highlighted:text-fd-accent-foreground [&_svg]:size-4 [&_svg]:shrink-0",
    tab.props?.class,
  ),
});
</script>

<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger
      class="flex w-full h-10 items-center gap-3 ps-[calc(--spacing(2.5)-1px)] pe-2.5 text-start font-medium outline-none transition-colors hover:bg-fd-accent focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-fd-ring data-[state=open]:bg-fd-accent [&_svg]:size-4 [&_svg]:shrink-0"
    >
      <TabIcon v-if="selected" :tab="selected" />
      <span :class="titleClass">
        <RenderNode v-if="selected" :node="selected.title" />
        <template v-else>{{ t("Layout Tab", { note: "layout tab trigger" }) }}</template>
      </span>
      <ChevronsUpDownIcon class="size-3.5! text-fd-muted-foreground" />
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        align="start"
        :side-offset="8"
        :align-offset="-4"
        position-strategy="fixed"
        class="z-50 flex flex-col w-[calc(var(--reka-dropdown-menu-trigger-width)+--spacing(2))] max-h-(--reka-dropdown-menu-content-available-height) overflow-y-auto p-1 rounded-2xl border bg-fd-popover text-sm text-fd-popover-foreground shadow-lg outline-none origin-(--reka-dropdown-menu-content-transform-origin) transition-[opacity,scale] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] starting:opacity-0 starting:scale-95 data-[state=closed]:animate-fd-popover-out motion-reduce:transition-none"
      >
        <template v-for="(tab, i) in options" :key="i">
          <DropdownMenuItem v-if="!tab.unlisted || tab === selected" as-child>
            <Link v-bind="linkProps(tab)">
              <TabIcon :tab="tab" class="mt-0.5" />
              <span class="flex flex-col flex-1 min-w-0">
                <span class="truncate font-medium"><RenderNode :node="tab.title" /></span>
                <span v-if="tab.description" class="truncate text-xs text-fd-muted-foreground">
                  <RenderNode :node="tab.description" />
                </span>
              </span>
              <CheckIcon v-if="tab === selected" class="mt-0.5 text-fd-primary" />
            </Link>
          </DropdownMenuItem>
        </template>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
