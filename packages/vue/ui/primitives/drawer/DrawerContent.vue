<script setup lang="ts">
import { useDrawerRootContext } from "./context";

/** A container for the drawer contents, a mouse drag doesn't swipe from it. Renders a `<div>` element. */
useDrawerRootContext();
</script>

<template>
  <div data-drawer-content="">
    <slot />
  </div>
</template>
