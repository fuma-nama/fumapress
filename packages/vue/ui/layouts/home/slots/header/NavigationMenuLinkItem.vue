<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import {
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuTrigger,
} from "reka-ui";
import { usePathname } from "../../../../core/framework";
import { Link } from "../../../../core/link";
import { cn } from "../../../../utils/cn";
import {
  isLinkItemActive,
  LinkItem,
  RenderNode,
  type LinkItemType,
  type MenuItemType,
} from "../../../shared";
import { navItemVariants } from "./context";

type MenuChild = Exclude<MenuItemType["items"][number], { type: "custom" }>;

defineOptions({ inheritAttrs: false });

const props = defineProps<{ item: LinkItemType; class?: HTMLAttributes["class"] }>();
const pathname = usePathname();
// `NavigationMenuLink` passes its own `data-active` down, which would replace the one of `LinkItem`
const active = computed(() => isLinkItemActive(props.item, pathname.value));
const itemClass = computed(() => cn("list-none", props.class));
const triggerClass = cn(navItemVariants(), "rounded-md");
// the contents share the viewport, which takes the height of the open one
const contentClass = cn(
  "absolute inset-x-0 top-0 p-3",
  "transition-[opacity,transform,translate] duration-(--duration) ease-(--easing)",
  "data-[motion=from-end]:animate-fd-enterFromRight data-[motion=from-start]:animate-fd-enterFromLeft",
  "data-[motion=to-end]:animate-fd-exitToRight data-[motion=to-start]:animate-fd-exitToLeft",
  "grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3",
);
const linkClass = (variant: "main" | "icon" | "button" | undefined) =>
  cn(navItemVariants({ variant }));

function menuLinkProps(child: MenuChild) {
  const { banner: _banner, class: className, ...rest } = child.menu ?? {};

  return {
    ...rest,
    class: cn(
      "flex flex-col gap-2 rounded-lg border bg-fd-card p-3 transition-colors hover:bg-fd-accent/80 hover:text-fd-accent-foreground",
      className,
    ),
  };
}
</script>

<template>
  <RenderNode v-if="item.type === 'custom'" :node="item.children" />
  <NavigationMenuItem v-else-if="item.type === 'menu'" :class="itemClass">
    <NavigationMenuTrigger :class="triggerClass">
      <Link v-if="item.url" :href="item.url" :external="item.external">
        <RenderNode :node="item.text" />
      </Link>
      <RenderNode v-else :node="item.text" />
    </NavigationMenuTrigger>
    <NavigationMenuContent :class="contentClass">
      <template
        v-for="(child, j) in item.items"
        :key="child.type === 'custom' ? j : `${j}-${child.url}`"
      >
        <RenderNode v-if="child.type === 'custom'" :node="child.children" />
        <NavigationMenuLink v-else as-child>
          <Link :href="child.url" :external="child.external" v-bind="menuLinkProps(child)">
            <RenderNode v-if="child.menu?.banner !== undefined" :node="child.menu.banner" />
            <div
              v-else-if="child.icon"
              class="w-fit rounded-md border bg-fd-muted p-1 [&_svg]:size-4"
            >
              <RenderNode :node="child.icon" />
            </div>
            <p class="text-base font-medium"><RenderNode :node="child.text" /></p>
            <p class="text-sm text-fd-muted-foreground empty:hidden">
              <RenderNode :node="child.description" />
            </p>
          </Link>
        </NavigationMenuLink>
      </template>
    </NavigationMenuContent>
  </NavigationMenuItem>
  <NavigationMenuItem v-else :class="itemClass">
    <NavigationMenuLink as-child>
      <LinkItem
        :item="item"
        :data-active="active"
        :aria-label="item.type === 'icon' ? item.label : undefined"
        :class="linkClass(item.type)"
      >
        <RenderNode :node="item.type === 'icon' ? item.icon : item.text" />
      </LinkItem>
    </NavigationMenuLink>
  </NavigationMenuItem>
</template>
