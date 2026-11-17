<script setup lang="ts">
import { computed, provide } from "vue";
import { useLinkItems } from "../shared";
import { LayoutKey, useBaseSlots } from "./context";
import type { HomeLayoutProps, HomeSlots } from "./index";
import InlineHeader from "./InlineHeader.vue";
import { Container } from "./slots/container";

defineOptions({ inheritAttrs: false });

// without a default, an absent `i18n` is `false`
const props = withDefaults(defineProps<HomeLayoutProps>(), { i18n: undefined });
const { baseSlots, baseProps } = useBaseSlots(() => props);
const linkItems = useLinkItems(() => props);
const navEnabled = computed(() => props.nav?.enabled ?? true);
const layoutSlots = computed<HomeSlots>(() => ({
  ...baseSlots.value,
  header: props.slots?.header ?? InlineHeader,
  container: props.slots?.container ?? Container,
}));

provide(LayoutKey, {
  props: baseProps,
  slots: layoutSlots,
  navItems: computed(() => linkItems.value.navItems),
  menuItems: computed(() => linkItems.value.menuItems),
});
</script>

<template>
  <component :is="layoutSlots.container" v-bind="$attrs">
    <component :is="layoutSlots.header" v-if="navEnabled" />
    <slot />
  </component>
</template>
