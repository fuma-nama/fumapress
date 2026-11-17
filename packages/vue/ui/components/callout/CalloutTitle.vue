<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import { cn } from "../../utils/cn";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
const className = computed(() => cn("font-medium my-0!", props.class));
</script>

<template>
  <p :class="className"><slot /></p>
</template>
