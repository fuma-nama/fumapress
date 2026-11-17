<script setup lang="ts">
import { computed, onMounted, shallowRef, watch, type HTMLAttributes } from "vue";
import { useTranslations } from "../../../core/translate";
import { cn } from "../../../utils/cn";

/** the other attributes reach the `<p>` */
const props = defineProps<{ date: Date; class?: HTMLAttributes["class"] }>();
const t = useTranslations({ note: "page footer" });
const date = shallowRef("");
const className = computed(() => cn("text-sm text-fd-muted-foreground", props.class));

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
</script>

<template>
  <p :class="className">{{ t("Last updated on") }} {{ date }}</p>
</template>
