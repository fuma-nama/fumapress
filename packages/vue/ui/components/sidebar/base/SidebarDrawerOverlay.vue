<script setup lang="ts">
import { shallowRef, watch } from "vue";
import { useSidebar } from "./context";

const { open, setOpen, mode } = useSidebar();
const hidden = shallowRef(!open.value);

watch(open, (open) => {
  if (open) hidden.value = false;
});

function onAnimationEnd() {
  if (!open.value) hidden.value = true;
}
</script>

<template>
  <div
    v-if="mode === 'drawer' && (open || !hidden)"
    :data-state="open ? 'open' : 'closed'"
    @click="setOpen(false)"
    @animationend="onAnimationEnd"
  />
</template>
