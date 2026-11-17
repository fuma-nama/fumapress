<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "../../../../contexts/i18n";

const { locales, locale } = useI18n();
const text = computed(() => locales.value?.find((item) => item.locale === locale.value)?.name);
</script>

<template>
  <span>{{ text }}</span>
</template>
