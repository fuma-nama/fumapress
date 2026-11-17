<script setup lang="ts">
import { provide, toRef } from "vue";
import { AnchorProvider, type AnchorProviderProps } from "../../core/toc";
import { TOCKey } from "./context";

const props = defineProps<AnchorProviderProps>();

provide(TOCKey, toRef(props, "toc"));
</script>

<template>
  <AnchorProvider :toc="toc" :single="single">
    <slot />
  </AnchorProvider>
</template>
