<script setup lang="ts">
import { useTranslations } from "../../../core/translate";

const t = useTranslations({ note: "skip link" });
</script>

<template>
  <a href="#nd-page" class="sr-only">{{ t("Skip to Content") }}</a>
</template>
