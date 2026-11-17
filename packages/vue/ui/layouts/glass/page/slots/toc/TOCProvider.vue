<script setup lang="ts">
import * as Base from "../../../../../components/toc";
import type { TOCProviderProps } from "./index";

defineProps<TOCProviderProps>();
</script>

<template>
  <Base.TOCProvider :toc="toc" :single="single">
    <slot />
  </Base.TOCProvider>
</template>
