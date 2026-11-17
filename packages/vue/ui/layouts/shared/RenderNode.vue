<script setup lang="ts">
import type { Component } from "vue";

/** renders a node of layout data (like `text` or `icon` of a link item): a text, or a component */
defineOptions({ inheritAttrs: false });
defineProps<{ node?: string | Component }>();
</script>

<template>
  <template v-if="typeof node === 'string'">{{ node }}</template>
  <component :is="node" v-else-if="node" v-bind="$attrs" />
</template>
