<script setup lang="ts">
import { computed, shallowRef, type HTMLAttributes } from "vue";
import { Check, ChevronsUpDown } from "lucide-vue-next";
import { useTreePath } from "../../../../contexts/tree";
import { usePathname } from "../../../../core/framework";
import { Link } from "../../../../core/link";
import { isLayoutTabActive, RenderNode, type LayoutTab } from "../../../../layouts/shared";
import { cn } from "../../../../utils/cn";
import { Popover, PopoverContent, PopoverTrigger } from "../../../ui/popover";
import { useSidebar } from "../../base";

defineOptions({ inheritAttrs: false });

const props = defineProps<{ options: LayoutTab[]; class?: HTMLAttributes["class"] }>();
const open = shallowRef(false);
const { closeOnRedirect } = useSidebar();
const pathname = usePathname();
const path = useTreePath();

const selected = computed(() =>
  props.options.findLast((item) => isLayoutTabActive(item, path.value, pathname.value)),
);

const onClick = () => {
  closeOnRedirect.value = false;
  open.value = false;
};

const triggerClass = computed(() =>
  cn(
    "flex items-center gap-2 rounded-lg p-2 border bg-fd-secondary/50 text-start text-fd-secondary-foreground transition-colors hover:bg-fd-accent data-[state=open]:bg-fd-accent data-[state=open]:text-fd-accent-foreground",
    props.class,
  ),
);

const isActive = (item: LayoutTab) =>
  selected.value !== undefined && item.url === selected.value.url;
const linkProps = (item: LayoutTab) => ({
  ...item.props,
  class: cn(
    "flex items-center gap-2 rounded-lg p-1.5 hover:bg-fd-accent hover:text-fd-accent-foreground",
    item.props?.class,
  ),
});
const checkClass = (item: LayoutTab) =>
  cn("shrink-0 ms-auto size-3.5 text-fd-primary", !isActive(item) && "invisible");
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger v-if="selected || $slots.placeholder" v-bind="$attrs" :class="triggerClass">
      <template v-if="selected">
        <div class="size-9 shrink-0 empty:hidden md:size-5">
          <RenderNode :node="selected.icon" />
        </div>
        <div>
          <p class="text-sm font-medium"><RenderNode :node="selected.title" /></p>
          <p class="text-sm text-fd-muted-foreground empty:hidden md:hidden">
            <RenderNode :node="selected.description" />
          </p>
        </div>
      </template>
      <slot v-else name="placeholder" />
      <ChevronsUpDown class="shrink-0 ms-auto size-4 text-fd-muted-foreground" />
    </PopoverTrigger>
    <PopoverContent
      class="flex flex-col gap-1 w-(--reka-popover-trigger-width) p-1 fd-scroll-container"
    >
      <template v-for="item in options" :key="item.url">
        <Link
          v-if="isActive(item) || !item.unlisted"
          :href="item.url"
          v-bind="linkProps(item)"
          @click="onClick"
        >
          <div class="shrink-0 size-9 md:mb-auto md:size-5 empty:hidden">
            <RenderNode :node="item.icon" />
          </div>
          <div>
            <p class="text-sm font-medium leading-none"><RenderNode :node="item.title" /></p>
            <p class="text-[0.8125rem] text-fd-muted-foreground mt-1 empty:hidden">
              <RenderNode :node="item.description" />
            </p>
          </div>

          <Check :class="checkClass(item)" />
        </Link>
      </template>
    </PopoverContent>
  </Popover>
</template>
