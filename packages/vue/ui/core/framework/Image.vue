<script setup lang="ts">
import type { ImageProps } from "./index";

defineProps<ImageProps>();
</script>

<template>
  <img :alt="alt" :src="src" :fetchpriority="priority ? 'high' : 'auto'" />
</template>
