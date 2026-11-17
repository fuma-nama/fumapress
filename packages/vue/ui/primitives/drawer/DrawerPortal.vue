<script setup lang="ts">
import { onBeforeUnmount, useId, useTemplateRef, watch } from "vue";
import { useDrawerRootContext } from "./context";

/** Moves the drawer to the end of `<body>` while it is mounted, renders a `<div>` element. */
defineOptions({ inheritAttrs: false });

const { open, mounted, internalBackdropElement } = useDrawerRootContext();
const id = useId();
const internalBackdrop = useTemplateRef<HTMLElement>("internalBackdrop");

watch(internalBackdrop, (element) => {
  internalBackdropElement.value = element;
});
onBeforeUnmount(() => {
  if (internalBackdropElement.value === internalBackdrop.value)
    internalBackdropElement.value = null;
});

const internalBackdropStyle = {
  position: "fixed",
  inset: 0,
  userSelect: "none",
  WebkitUserSelect: "none",
} as const;
</script>

<template>
  <Teleport v-if="mounted" to="body">
    <div :id="id" data-base-ui-portal="" v-bind="$attrs">
      <!-- the backdrop of a modal drawer, which makes a press outside of the popup dismiss it -->
      <div
        ref="internalBackdrop"
        role="presentation"
        data-base-ui-inert=""
        :inert="!open"
        :style="internalBackdropStyle"
      />
      <slot />
    </div>
  </Teleport>
</template>
