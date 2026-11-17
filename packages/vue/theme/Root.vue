<script setup lang="ts">
import { computed } from "vue";
import { usePress } from "@fumapress/vue/client";
import { RootProvider, type RootProviderProps } from "../ui/provider/base";

/**
 * `search` adds to the search options of the site, to use a dialog of your own: `{ SearchDialog }`. It receives the
 * options of the search plugin, when the site has one.
 */
const props = defineProps<{ search?: RootProviderProps["search"] }>();

const state = usePress();
// search is on when a plugin provides it, or with a dialog of your own
const search = computed(() => {
  const ofSite = state.site.layout.search ?? { enabled: false };
  return props.search ? { ...ofSite, enabled: true, ...props.search } : ofSite;
});
</script>

<template>
  <RootProvider :search="search" :i18n="state.site.i18n">
    <slot />
  </RootProvider>
</template>
