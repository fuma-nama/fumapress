<script setup lang="ts">
import { onMounted, shallowRef } from "vue";
import PageTOCPopoverPhysical from "./PageTOCPopoverPhysical.vue";

/** rendered into the slot of the navigation panel, the attributes reach `PageTOCPopoverPhysical` */
defineOptions({ inheritAttrs: false });

const container = shallowRef<HTMLElement | null>(null);

onMounted(() => {
  const element = document.getElementById("flux-layout-slot");
  if (!element) return;
  container.value = element;
});
</script>

<template>
  <Teleport v-if="container" :to="container">
    <PageTOCPopoverPhysical v-bind="$attrs"><slot /></PageTOCPopoverPhysical>
  </Teleport>
</template>
