<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import { cn } from "../../utils/cn";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
const className = computed(() =>
  cn("text-fd-muted-foreground prose-no-margin empty:hidden", props.class),
);
</script>

<template>
  <div :class="className"><slot /></div>
</template>
