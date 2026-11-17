<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import { cn } from "../../utils/cn";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
const className = computed(() => cn("min-w-full w-max *:flex *:flex-col", props.class));
</script>

<template>
  <pre :class="className"><slot /></pre>
</template>
