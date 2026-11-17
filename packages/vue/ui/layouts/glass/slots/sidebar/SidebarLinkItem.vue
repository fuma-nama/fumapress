<script setup lang="ts">
import { computed, shallowRef, type HTMLAttributes } from "vue";
import { ChevronDown } from "lucide-vue-next";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../../../components/ui/collapsible";
import { usePathname } from "../../../../core/framework";
import { Link } from "../../../../core/link";
import { cn } from "../../../../utils/cn";
import { isLinkItemActive, RenderNode, type LinkItemType } from "../../../shared";
import { drawerHandle, itemTriggerVariants } from "./context";

const props = defineProps<{
  item: Exclude<LinkItemType, { type: "icon" }>;
  class?: HTMLAttributes["class"];
}>();
const pathname = usePathname();
const open = shallowRef(true);
const active = computed(() => isLinkItemActive(props.item, pathname.value));

const rightIconClass = computed(() =>
  cn(
    "ms-auto text-fd-muted-foreground size-3.5! transition-transform",
    !open.value && "-rotate-90",
  ),
);
const menuClass = computed(() => cn("mt-4 first:mt-0", props.class));
const menuLinkClass = computed(() =>
  cn(
    "inline-flex items-center gap-2 [&_svg]:size-4",
    active.value
      ? "text-fd-primary"
      : "hover:underline hover:decoration-fd-muted-foreground hover:underline-offset-4 hover:decoration-dashed hover:text-fd-accent-foreground",
  ),
);
const linkClass = computed(() =>
  cn(
    itemTriggerVariants({
      active: active.value,
      className: props.class,
    }),
  ),
);
</script>

<template>
  <div v-if="item.type === 'custom'" :class="props.class"><RenderNode :node="item.children" /></div>
  <Collapsible v-else-if="item.type === 'menu'" v-model:open="open" :class="menuClass">
    <div v-if="item.url" class="flex w-full px-2.5 py-1.5 font-medium">
      <Link
        :href="item.url"
        :external="item.external"
        :aria-current="active ? 'page' : undefined"
        :class="menuLinkClass"
        @click="drawerHandle.close()"
      >
        <RenderNode :node="item.icon" />
        <RenderNode :node="item.text" />
      </Link>
      <CollapsibleTrigger class="flex-1"
        ><ChevronDown :class="rightIconClass"
      /></CollapsibleTrigger>
    </div>
    <CollapsibleTrigger
      v-else
      class="w-full px-2.5 py-1.5 font-medium inline-flex items-center gap-2 [&_svg]:size-4"
    >
      <RenderNode :node="item.icon" />
      <RenderNode :node="item.text" />
      <ChevronDown :class="rightIconClass" />
    </CollapsibleTrigger>

    <CollapsibleContent class="flex flex-col">
      <SidebarLinkItem v-for="(child, i) in item.items" :key="i" :item="child" />
    </CollapsibleContent>
  </Collapsible>
  <Link
    v-else
    :href="item.url"
    :external="item.external"
    :aria-current="active ? 'page' : undefined"
    :class="linkClass"
    @click="drawerHandle.close()"
  >
    <RenderNode :node="item.icon" />
    <RenderNode :node="item.text" />
  </Link>
</template>
