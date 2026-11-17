<script setup lang="ts">
import { computed, onMounted, shallowRef, watch, type HTMLAttributes } from "vue";
import { useTranslations } from "../../../core/translate";
import { cn } from "../../../utils/cn";

const props = defineProps<{ date: Date; class?: HTMLAttributes["class"] }>();
const t = useTranslations({ note: "page footer" });
const date = shallowRef("");

onMounted(() => {
  watch(
    () => props.date,
    (value) => {
      // to the timezone of client
      date.value = value.toLocaleDateString();
    },
    { immediate: true },
  );
});

const className = computed(() => cn("text-sm text-fd-muted-foreground", props.class));
</script>

<template>
  <p :class="className">{{ t("Last updated on") }} {{ date }}</p>
</template>
