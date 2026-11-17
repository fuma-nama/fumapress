<script setup lang="ts">
import { computed } from "vue";
import { FileIcon } from "../../icons";
import { cn } from "../../utils/cn";
import { itemVariants } from "./context";
import type { FileProps } from "./index";

const props = defineProps<FileProps>();
const className = computed(() => cn(itemVariants({ class: props.class })));
const Icon = () => props.icon;
</script>

<template>
  <div :class="className">
    <slot name="icon">
      <Icon v-if="icon !== undefined" />
      <FileIcon v-else /> </slot
    >{{ name }}
  </div>
</template>
