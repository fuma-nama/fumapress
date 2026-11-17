<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import { cn } from "../../../utils/cn";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
const className = computed(() => cn("text-[1.75em] font-semibold", props.class));
</script>

<template>
  <h1 :class="className"><slot /></h1>
</template>
