<script setup lang="ts">
import { computed, shallowRef, type HTMLAttributes } from "vue";
import { ChevronDown } from "../../../../icons";
import { Popover, PopoverContent, PopoverTrigger } from "../../../../components/ui/popover";
import { cn } from "../../../../utils/cn";
import { LinkItem, RenderNode, type MenuItemType } from "../../../shared";

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{ item: MenuItemType; hoverDelay?: number; class?: HTMLAttributes["class"] }>(),
  { hoverDelay: 50 },
);
const open = shallowRef(false);
let timeout: number | null = null;
let freezeUntil: number | null = null;

const delaySetOpen = (value: boolean) => {
  if (timeout) {
    clearTimeout(timeout);
    timeout = null;
  }

  timeout = window.setTimeout(() => {
    open.value = value;
    freezeUntil = Date.now() + 300;
  }, props.hoverDelay);
};
const onPointerEnter = (e: PointerEvent) => {
  if (e.pointerType === "touch") return;
  delaySetOpen(true);
};
const onPointerLeave = (e: PointerEvent) => {
  if (e.pointerType === "touch") return;
  delaySetOpen(false);
};
function isTouchDevice() {
  return "ontouchstart" in window || navigator.maxTouchPoints > 0;
}

function onClickItem() {
  if (isTouchDevice()) open.value = false;
}

function onOpenChange(value: boolean) {
  if (freezeUntil === null || Date.now() >= freezeUntil) open.value = value;
}

const triggerClass = computed(() =>
  cn(
    "inline-flex items-center gap-1.5 p-1 text-sm text-fd-muted-foreground transition-colors has-data-[active=true]:text-fd-primary data-[state=open]:text-fd-accent-foreground focus-visible:outline-none",
    props.class,
  ),
);
</script>

<template>
  <Popover :open="open" @update:open="onOpenChange">
    <PopoverTrigger
      :class="triggerClass"
      @pointerenter="onPointerEnter"
      @pointerleave="onPointerLeave"
      v-bind="$attrs"
    >
      <LinkItem v-if="item.url" :item="item as never">
        <RenderNode :node="item.text" />
      </LinkItem>
      <RenderNode v-else :node="item.text" />
      <ChevronDown class="size-3" />
    </PopoverTrigger>
    <PopoverContent
      class="flex flex-col p-1 text-fd-muted-foreground text-start"
      @pointerenter="onPointerEnter"
      @pointerleave="onPointerLeave"
    >
      <template v-for="(child, i) in item.items" :key="i">
        <RenderNode v-if="child.type === 'custom'" :node="child.children" />
        <LinkItem
          v-else
          :item="child"
          class="inline-flex items-center gap-2 rounded-md p-2 transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground data-[active=true]:text-fd-primary [&_svg]:size-4"
          @click="onClickItem"
        >
          <RenderNode :node="child.icon" />
          <RenderNode :node="child.text" />
        </LinkItem>
      </template>
    </PopoverContent>
  </Popover>
</template>
