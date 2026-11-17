<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, useAttrs, useTemplateRef } from "vue";
import { FocusScope } from "reka-ui";
import {
  DrawerCssVars,
  popupStateAttributes,
  removeCSSVariableInheritance,
  useDrawerRootContext,
} from "./context";
import { injectSwiping } from "./viewport-context";

/**
 * A container for the drawer contents, renders a `<div>` element. It traps the focus while the drawer is open, and
 * returns it to the trigger once it unmounts.
 */
defineOptions({ inheritAttrs: false });

const attrs = useAttrs();
const {
  open,
  mounted,
  transitionStatus,
  swipeDirection,
  floatingId,
  titleId,
  popupElement,
  popupHeight,
} = useDrawerRootContext();
const swiping = injectSwiping();
const scope = useTemplateRef<{ $el: HTMLElement }>("scope");

const id = computed(() => (attrs.id as string | undefined) ?? floatingId);
const stateAttributes = computed(() => ({
  ...popupStateAttributes(open.value, transitionStatus.value),
  "data-swipe-direction": swipeDirection.value,
  "data-swiping": swiping?.value ? "" : undefined,
}));
// the variables changed while swiping are written outside of the render
const style = computed(() => ({
  [DrawerCssVars.height]:
    popupHeight.value && transitionStatus.value === "ending" ? `${popupHeight.value}px` : undefined,
  [DrawerCssVars.frontmostHeight]: popupHeight.value ? `${popupHeight.value}px` : undefined,
}));

// arrow keys, `Home` and `End` stay in the popup
const COMPOSITE_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"]);
function onKeyDown(event: KeyboardEvent) {
  if (COMPOSITE_KEYS.has(event.key)) event.stopPropagation();
}

// the drawer focuses its popup when it opens
function onMountAutoFocus(event: Event) {
  event.preventDefault();
  scope.value?.$el.focus({ preventScroll: true });
}

let resizeObserver: ResizeObserver | undefined;
onMounted(() => {
  const el = scope.value?.$el;
  if (!el) return;
  removeCSSVariableInheritance();
  el.style.setProperty(DrawerCssVars.swipeMovementX, "0px");
  el.style.setProperty(DrawerCssVars.swipeMovementY, "0px");
  el.style.setProperty(DrawerCssVars.swipeProgress, "0");
  el.style.setProperty(DrawerCssVars.nestedDrawers, "0");
  el.style.setProperty(DrawerCssVars.snapPointOffset, "0px");
  el.style.setProperty(DrawerCssVars.swipeStrength, "1");
  popupElement.value = el;

  // reading the height also computes the starting style, which the opening transition starts from
  const measure = () => {
    popupHeight.value = el.offsetHeight;
  };
  measure();
  if (typeof ResizeObserver === "function") {
    resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(el);
  }
});
onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  if (popupElement.value === scope.value?.$el) popupElement.value = null;
  popupHeight.value = 0;
});
</script>

<template>
  <FocusScope
    ref="scope"
    as="div"
    loop
    :trapped="open"
    v-bind="{ ...$attrs, ...stateAttributes }"
    :id="id"
    role="dialog"
    :aria-labelledby="titleId"
    tabindex="-1"
    data-base-ui-focusable=""
    :hidden="!mounted"
    :style="style"
    @keydown="onKeyDown"
    @mount-auto-focus="onMountAutoFocus"
  >
    <slot />
  </FocusScope>
</template>
