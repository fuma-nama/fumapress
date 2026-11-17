<script setup lang="ts">
import { useDrawerRootContext } from "./context";

/** A button that closes the drawer, renders a `<button>` element. */
const { open, setOpen } = useDrawerRootContext();

function onClick() {
  if (open.value) setOpen(false, "close-press");
}
</script>

<template>
  <button type="button" @click="onClick">
    <slot />
  </button>
</template>
