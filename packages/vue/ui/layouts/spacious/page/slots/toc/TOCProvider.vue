<script setup lang="ts">
import * as Base from "../../../../../components/toc";
import type { TOCProviderProps } from "./index";

// a boolean prop is `false` without a default
const props = withDefaults(defineProps<TOCProviderProps>(), { single: undefined });
</script>

<template>
  <Base.TOCProvider v-bind="props">
    <slot />
  </Base.TOCProvider>
</template>
