<script setup lang="ts">
import { computed, provide, shallowRef } from "vue";
import { Text } from "../../../../../icons";
import * as Base from "../../../../../components/toc";
import { useTranslations } from "../../../../../core/translate";
import { useOnChange } from "../../../../../core/utils/use-on-change";
import { cn } from "../../../../../utils/cn";
import { useGlassLayout } from "../../..";
import { TOCContextKey } from "./context";
import type { TOCProps } from "./index";
import TOCPanel from "./TOCPanel.vue";

const props = defineProps<TOCProps>();
const t = useTranslations({ note: "table of contents" });
const items = Base.useTOCItems();
const { props: layout } = useGlassLayout();
const hover = shallowRef(false);
const mobileOpen = shallowRef(false);
const inAnimation = shallowRef(false);
let exitTimer: number | null = null;
let transitionTimer: number | null = null;
const open = computed(() => hover.value || mobileOpen.value);

useOnChange(open, () => {
  inAnimation.value = true;

  if (transitionTimer) window.clearTimeout(transitionTimer);
  transitionTimer = window.setTimeout(() => {
    inAnimation.value = false;
  }, 300);
});

const setMobileOpen = (v: boolean) => {
  mobileOpen.value = v;
};

provide(TOCContextKey, { open, setMobileOpen, inAnimation });

const overlayClass = computed(() =>
  cn(
    "fixed inset-0 z-10 backdrop-blur-sm transition-opacity duration-300 [mask-image:radial-gradient(circle_at_center_right,white,white_200px,transparent_500px)] xl:hidden",
    !open.value && "opacity-0 pointer-events-none",
  ),
);
const containerProps = computed(() => ({
  ...props.container,
  class: cn(
    "z-10 grid transition-[width,padding] duration-300 [grid-area:right]",
    layout.value.aiChat?.open && layout.value.aiChat.panel && "invisible",
    "xl:sticky xl:top-10 xl:h-[calc(100dvh---spacing(10))] md:layout:[--fd-right-width:12px] xl:layout:[--fd-right-width:240px] xl:items-center xl:pe-4",
    "max-xl:fixed max-xl:top-1/2 max-xl:-translate-y-1/2 max-xl:end-1 max-xl:bg-fd-popover max-xl:text-fd-popover-foreground max-xl:border max-xl:rounded-xl max-xl:shadow-md max-xl:mask-none max-xl:max-h-[calc(100dvh---spacing(32))] max-xl:grid-cols-[calc(240px---spacing(6))]",
    inAnimation.value && "overflow-y-hidden",
    open.value
      ? "max-xl:w-[240px] max-xl:p-3"
      : "max-md:w-4 max-md:ps-[calc(--spacing(1.5)-1px)] max-xl:w-6 max-xl:ps-[calc(--spacing(2.5)-1px)] max-xl:overflow-clip",
    props.container?.class,
  ),
}));
const titleClass = computed(() =>
  cn(
    "inline-flex items-center gap-1.5 overflow-hidden text-xs text-fd-muted-foreground transition-[opacity,height] opacity-0 h-0",
    open.value
      ? "opacity-100 h-6"
      : "xl:[@media(hover:none)]:opacity-100 xl:[@media(hover:none)]:h-6",
  ),
);

function onPointerDown(e: PointerEvent) {
  if (!mobileOpen.value && (e.pointerType === "touch" || e.pointerType === "pen")) {
    mobileOpen.value = true;
  }
}

function onPointerEnter(e: PointerEvent) {
  if (e.pointerType === "mouse") {
    if (exitTimer) window.clearTimeout(exitTimer);
    if (!hover.value) hover.value = true;
  }
}

function onPointerLeave(e: PointerEvent) {
  if (hover.value && e.pointerType === "mouse") {
    if (exitTimer) window.clearTimeout(exitTimer);
    exitTimer = window.setTimeout(
      () => {
        hover.value = false;
      },
      // If the pointer leaves the window, use a longer timeout
      window.innerWidth - e.clientX < 30 ? 700 : 50,
    );
  }
}
</script>

<template>
  <template v-if="items.length > 0 || $slots.footer || $slots.header">
    <div :class="overlayClass" @click="mobileOpen = false" />
    <Base.TOCScrollArea
      id="nd-toc"
      v-bind="containerProps"
      @pointerdown="onPointerDown"
      @pointerenter="onPointerEnter"
      @pointerleave="onPointerLeave"
    >
      <div class="flex flex-col xl:items-end xl:text-end">
        <slot name="header" />
        <h3 id="nd-toc-title" :class="titleClass">
          <Text class="size-3.5 shrink-0" />{{ t("On this page") }}
        </h3>
        <TOCPanel />
        <slot name="footer" />
      </div>
    </Base.TOCScrollArea>
  </template>
</template>
