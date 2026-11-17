<script setup lang="ts">
import { inject } from "vue";
import { defaultContext, SearchKey } from "./context";

/**
 * Show children only when search is enabled via the search context
 */
const search = inject(SearchKey, defaultContext);
</script>

<template>
  <slot v-if="search.enabled" />
</template>
