<script setup lang="ts">
import { computed, defineAsyncComponent, provide, shallowRef, toRef } from "vue";
import { useHotKey } from "../../utils/hotkey";
import { DEFAULT_HOT_KEYS, SearchKey } from "./context";
import type { SearchProviderProps } from "./index";

const DefaultSearchDialog = defineAsyncComponent(
  () => import("../../components/dialog/search-default"),
);

const props = withDefaults(defineProps<SearchProviderProps>(), {
  preload: true,
  hotKey: () => DEFAULT_HOT_KEYS,
});
// a default in `withDefaults()` can't refer to a variable of the setup
const Dialog = computed(() => props.SearchDialog ?? DefaultSearchDialog);
const isOpen = shallowRef(props.preload ? false : undefined);
const setIsOpen = (value: boolean) => {
  isOpen.value = value;
};

useHotKey((e) => {
  if (props.hotKey.every((v) => (typeof v.key === "string" ? e.key === v.key : v.key(e)))) {
    isOpen.value = !isOpen.value;
    e.preventDefault();
  }
});

provide(SearchKey, {
  enabled: true,
  open: computed(() => isOpen.value ?? false),
  hotKey: toRef(props, "hotKey"),
  setOpenSearch: setIsOpen,
});
</script>

<template>
  <component
    :is="Dialog"
    v-if="isOpen !== undefined"
    :open="isOpen"
    :links="links"
    v-bind="options"
    @update:open="setIsOpen"
  />

  <slot />
</template>
