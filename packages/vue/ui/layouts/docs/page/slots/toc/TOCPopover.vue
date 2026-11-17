<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, provide, shallowRef, useTemplateRef } from "vue";
import * as Base from "../../../../../components/toc";
import { Collapsible } from "../../../../../components/ui/collapsible";
import { cn } from "../../../../../utils/cn";
import { useDocsLayout } from "../../..";
import { TocPopoverKey, variants } from "./context";
import type { TOCPopoverProps } from "./index";
import PageTOCPopoverContent from "./PageTOCPopoverContent.vue";
import PageTOCPopoverTrigger from "./PageTOCPopoverTrigger.vue";

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<TOCPopoverProps>(), { style: "normal" });
const items = Base.useTOCItems();
const headerRef = useTemplateRef<HTMLElement>("header");
const open = shallowRef(false);
const setOpen = (value: boolean) => {
  open.value = value;
};
const { isNavTransparent } = useDocsLayout();
const variant = computed(() => variants[props.style]);

const onClickOutside = (e: Event) => {
  if (!open.value || !(e.target instanceof HTMLElement)) return;

  if (headerRef.value && !headerRef.value.contains(e.target)) setOpen(false);
};

const onClickItem = () => {
  setOpen(false);
};

onMounted(() => {
  window.addEventListener("click", onClickOutside);
});

onBeforeUnmount(() => {
  window.removeEventListener("click", onClickOutside);
});

provide(TocPopoverKey, { open, setOpen });

const className = computed(() =>
  cn(
    "sticky top-(--fd-docs-row-2) z-10 [grid-area:toc-popover] h-(--fd-toc-popover-height) xl:hidden max-xl:layout:[--fd-toc-popover-height:--spacing(10)]",
    props.container?.class,
  ),
);
// the header has `role="none"`: not the page banner
const headerClass = computed(() =>
  cn(
    "border-b backdrop-blur-sm transition-colors",
    (!isNavTransparent.value || open.value) && "bg-fd-background/80",
    open.value && "shadow-lg",
  ),
);
</script>

<template>
  <Collapsible
    :open="open"
    data-toc-popover=""
    v-bind="{ ...container, class: className }"
    @update:open="setOpen"
  >
    <header ref="header" role="none" :class="headerClass">
      <PageTOCPopoverTrigger v-bind="trigger" />
      <PageTOCPopoverContent v-bind="content">
        <slot name="header" />
        <Base.TOCScrollArea class="ms-px">
          <component :is="variant.TOCItems" v-bind="list">
            <component :is="variant.TOCEmpty" v-if="items.length === 0" />
            <component
              :is="variant.TOCItem"
              v-for="item in items"
              :key="item.url"
              :item="item"
              @click="onClickItem"
            />
          </component>
        </Base.TOCScrollArea>
        <slot name="footer" />
      </PageTOCPopoverContent>
    </header>
  </Collapsible>
</template>
