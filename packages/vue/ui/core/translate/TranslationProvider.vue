<script setup lang="ts">
import { computed, inject, provide } from "vue";
import { TranslationsKey, type TranslationValues } from "./context";

/** add translations, you can stack multiple <TranslationProvider /> to override/extend translations */
const props = defineProps<{ translations: TranslationValues }>();
const parent = inject(TranslationsKey, undefined);

provide(
  TranslationsKey,
  computed(() => ({ ...parent?.value, ...props.translations })),
);
</script>

<template>
  <slot />
</template>
