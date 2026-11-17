<script setup lang="ts">
import { h, useSlots, type VNodeChild } from "vue";
import { ConfigProvider } from "@fumapress/vue/reka/config-provider";
import { I18nProvider } from "../../contexts/i18n";
import { SearchProvider } from "../../contexts/search";
import { ThemeProvider } from "../../core/theme";
import type { RootProviderProps } from "./index";
import ThemeHotKey from "./ThemeHotKey.vue";

const props = withDefaults(defineProps<RootProviderProps>(), { dir: "ltr", theme: () => ({}) });
const slots = useSlots();

function Body() {
  let body: () => VNodeChild = () => slots.default?.();

  if (props.search?.enabled !== false) {
    const { enabled: _, ...search } = props.search ?? {};
    const children = body;

    body = () => h(SearchProvider, search, children);
  }

  if (props.theme?.enabled !== false) {
    const { hotKey = "d" } = props.theme;
    const children = body;

    body = () =>
      h(ThemeProvider, null, () => [hotKey !== false && h(ThemeHotKey, { hotKey }), children()]);
  }

  if (props.i18n) {
    const i18n = props.i18n;
    const children = body;

    body = () => h(I18nProvider, i18n, children);
  }

  return h(ConfigProvider, { dir: props.dir }, body);
}
</script>

<template>
  <Body />
</template>
