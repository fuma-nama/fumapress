<script setup lang="ts">
import { useTranslations } from "../../../core/translate";

const t = useTranslations({ note: "table of contents" });
</script>

<template>
  <div class="rounded-lg border bg-fd-card p-3 text-xs text-fd-muted-foreground">
    {{ t("No Headings") }}
  </div>
</template>
