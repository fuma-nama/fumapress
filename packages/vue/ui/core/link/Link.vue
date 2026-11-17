<script setup lang="ts">
import { computed } from "vue";
import { Link as Base, safeHref } from "@fumapress/vue/client";
import type { LinkProps } from "./index";

const props = withDefaults(defineProps<LinkProps>(), { href: "#", external: undefined });
const isExternal = computed(
  () =>
    props.external ??
    // any protocol, or a protocol relative URL
    (/^\w+:/.test(props.href) || props.href.startsWith("//")),
);
</script>

<template>
  <a v-if="isExternal" :href="safeHref(href)" rel="noreferrer noopener" target="_blank"><slot /></a>
  <Base v-else :href="href"><slot /></Base>
</template>
