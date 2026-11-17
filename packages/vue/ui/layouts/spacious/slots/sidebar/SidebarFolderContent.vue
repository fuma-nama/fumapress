<script setup lang="ts">
import * as Base from "../../../../components/sidebar/base";

defineOptions({ inheritAttrs: false });
</script>

<template>
  <Base.SidebarFolderContent v-bind="$attrs" class="relative flex flex-col ms-3 ps-1">
    <span class="absolute start-0 inset-y-1 w-px bg-fd-border" />
    <slot />
  </Base.SidebarFolderContent>
</template>
