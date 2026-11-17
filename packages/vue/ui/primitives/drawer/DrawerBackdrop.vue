<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, useTemplateRef } from "vue";
import { DrawerCssVars, popupStateAttributes, useDrawerRootContext } from "./context";

/** An overlay beneath the popup, renders a `<div>` element. */
const { open, mounted, transitionStatus, backdropElement } = useDrawerRootContext();
const element = useTemplateRef<HTMLElement>("element");

const stateAttributes = computed(() => popupStateAttributes(open.value, transitionStatus.value));
const style = computed(() => ({
  pointerEvents: open.value ? undefined : ("none" as const),
  userSelect: "none" as const,
  WebkitUserSelect: "none" as const,
}));

onMounted(() => {
  const el = element.value;
  if (!el) return;
  // written outside of the render, since the viewport changes them while swiping
  el.style.setProperty(DrawerCssVars.swipeProgress, "0");
  el.style.setProperty(DrawerCssVars.swipeStrength, "1");
  backdropElement.value = el;
});
onBeforeUnmount(() => {
  if (backdropElement.value === element.value) backdropElement.value = null;
});
</script>

<template>
  <div
    ref="element"
    role="presentation"
    :hidden="!mounted"
    :style="style"
    v-bind="stateAttributes"
  />
</template>
