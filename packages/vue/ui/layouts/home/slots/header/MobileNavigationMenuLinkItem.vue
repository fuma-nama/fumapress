<script setup lang="ts">
import { computed, inject, type HTMLAttributes } from "vue";
import { buttonVariants } from "../../../../components/ui/button";
import { Link } from "../../../../core/link";
import { cn } from "../../../../utils/cn";
import { LinkItem, RenderNode, type LinkItemType } from "../../../shared";
import { MobileNavigationMenuKey } from "./context";

const props = defineProps<{ item: LinkItemType; class?: HTMLAttributes["class"] }>();
const { setOpen } = inject(MobileNavigationMenuKey)!;
const customClass = computed(() => cn("grid", props.class));
const menuClass = computed(() => cn("mb-4 flex flex-col", props.class));
const linkClass = (type: "main" | "icon" | "button" | undefined) =>
  cn(
    {
      main: "inline-flex items-center gap-2 py-1.5 transition-colors hover:text-fd-popover-foreground/50 data-[active=true]:font-medium data-[active=true]:text-fd-primary [&_svg]:size-4",
      icon: buttonVariants({
        size: "icon",
        variant: "ghost",
      }),
      button: buttonVariants({
        variant: "secondary",
        className: "gap-1.5 [&_svg]:size-4",
      }),
    }[type ?? "main"],
    props.class,
  );
</script>

<template>
  <div v-if="item.type === 'custom'" :class="customClass">
    <RenderNode :node="item.children" />
  </div>
  <div v-else-if="item.type === 'menu'" :class="menuClass">
    <p class="mb-1 text-sm text-fd-muted-foreground">
      <Link v-if="item.url" :href="item.url" :external="item.external" @click="setOpen(false)">
        <RenderNode :node="item.icon" />
        <RenderNode :node="item.text" />
      </Link>
      <template v-else>
        <RenderNode :node="item.icon" />
        <RenderNode :node="item.text" />
      </template>
    </p>
    <MobileNavigationMenuLinkItem v-for="(child, i) in item.items" :key="i" :item="child" />
  </div>
  <LinkItem
    v-else
    :item="item"
    :class="linkClass(item.type)"
    :aria-label="item.type === 'icon' ? item.label : undefined"
    @click="setOpen(false)"
  >
    <RenderNode :node="item.icon" />
    <RenderNode v-if="item.type !== 'icon'" :node="item.text" />
  </LinkItem>
</template>
