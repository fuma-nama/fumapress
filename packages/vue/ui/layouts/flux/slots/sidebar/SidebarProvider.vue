<script setup lang="ts">
import * as Base from "../../../../components/sidebar/base";
import type { SidebarProviderProps } from "./index";

// a boolean prop is `false` without a default
withDefaults(defineProps<SidebarProviderProps>(), { prefetch: undefined });
</script>

<template>
  <Base.SidebarProvider
    :default-open-level="defaultOpenLevel"
    :prefetch="prefetch"
    :collapsible="false"
  >
    <slot />
  </Base.SidebarProvider>
</template>
