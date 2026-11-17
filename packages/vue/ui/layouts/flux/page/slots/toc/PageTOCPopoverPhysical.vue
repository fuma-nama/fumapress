<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  provide,
  shallowRef,
  useTemplateRef,
  type HTMLAttributes,
} from "vue";
import { Collapsible } from "../../../../../components/ui/collapsible";
import { cn } from "../../../../../utils/cn";
import { TocPopoverKey } from "./context";

defineOptions({ inheritAttrs: false });

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
const headerRef = useTemplateRef<HTMLElement>("header");
const open = shallowRef(false);
const setOpen = (value: boolean) => {
  open.value = value;
};

const onClick = (e: Event) => {
  if (!open.value) return;

  if (headerRef.value && !headerRef.value.contains(e.target as HTMLElement)) setOpen(false);
};

onMounted(() => {
  window.addEventListener("click", onClick);
});

onBeforeUnmount(() => {
  window.removeEventListener("click", onClick);
});

provide(TocPopoverKey, { open, setOpen });

const className = computed(() => cn("relative h-9 animate-fd-fade-in", props.class));
// not the page banner
const headerClass = computed(() =>
  cn(
    "absolute w-full bottom-0 border rounded-xl transition-colors bg-fd-secondary text-fd-secondary-foreground backdrop-blur-sm",
    open.value && "shadow-lg bg-fd-popover/80 text-fd-popover-foreground",
  ),
);
</script>

<template>
  <Collapsible
    :open="open"
    data-toc-popover=""
    :class="className"
    v-bind="$attrs"
    @update:open="setOpen"
  >
    <header ref="header" role="none" :class="headerClass">
      <slot />
    </header>
  </Collapsible>
</template>
