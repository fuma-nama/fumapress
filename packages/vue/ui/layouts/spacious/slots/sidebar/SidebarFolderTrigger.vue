<script setup lang="ts">
import * as Base from "../../../../components/sidebar/base";
import { cn } from "../../../../utils/cn";
import { itemVariants } from "./utils";

defineOptions({ inheritAttrs: false });

const className = cn(itemVariants(), "[&>[data-icon]]:size-3.5");
</script>

<template>
  <Base.SidebarFolderTrigger v-bind="$attrs" :class="className">
    <slot />
  </Base.SidebarFolderTrigger>
</template>
