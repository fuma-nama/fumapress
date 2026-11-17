<script setup lang="ts">
import * as Base from "../../../../components/sidebar/base";
import type { SidebarProviderProps } from "./index";

// a boolean prop is `false` without a default
const props = withDefaults(defineProps<SidebarProviderProps>(), { prefetch: undefined });
</script>

<template>
  <Base.SidebarProvider v-bind="props">
    <slot />
  </Base.SidebarProvider>
</template>
