<script setup lang="ts">
import { provide, toRef } from "vue";
import type { ScrollProviderProps } from "./index";
import { ScrollKey } from "./observer";

const props = defineProps<ScrollProviderProps>();

provide(ScrollKey, toRef(props, "containerRef"));
</script>

<template>
  <slot />
</template>
