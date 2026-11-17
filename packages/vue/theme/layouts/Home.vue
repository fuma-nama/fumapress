<script setup lang="ts">
import { computed } from "vue";
import { HomeLayout, type HomeLayoutProps } from "../../ui/layouts/home";
import { mergeLayoutProps } from ".";

/**
 * The home layout with the navbar of the site, around its default slot: for landing pages, views and custom pages.
 * `layoutProps` win over `ui.layoutProps` of the config, and can hold components and functions.
 */
const props = defineProps<{ layoutProps?: Partial<HomeLayoutProps> }>();
const merged = mergeLayoutProps(() => props.layoutProps);
// the tabs of the sidebar are of the docs layouts
const layoutProps = computed(() => {
  const { tabs: _, ...own }: { tabs?: unknown } = merged.value;
  return own;
});
</script>

<template>
  <HomeLayout v-bind="layoutProps">
    <slot />
  </HomeLayout>
</template>
