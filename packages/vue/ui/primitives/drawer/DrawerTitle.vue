<script setup lang="ts">
import { computed, onBeforeUnmount, useAttrs, useId, watch } from "vue";
import { useDrawerRootContext, type DrawerTitleProps } from "./context";

/** A heading that labels the drawer, renders an `<h2>` element. */
withDefaults(defineProps<DrawerTitleProps>(), { as: "h2" });

const attrs = useAttrs();
const { titleId } = useDrawerRootContext();
const generatedId = useId();
const id = computed(() => (attrs.id as string | undefined) ?? generatedId);

watch(
  id,
  (value) => {
    titleId.value = value;
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  if (titleId.value === id.value) titleId.value = undefined;
});
</script>

<template>
  <component :is="as" :id="id">
    <slot />
  </component>
</template>
