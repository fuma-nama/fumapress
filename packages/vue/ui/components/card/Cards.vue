<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import { cn } from "../../utils/cn";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
const className = computed(() => cn("grid grid-cols-2 gap-3 @container", props.class));
</script>

<template>
  <div :class="className"><slot /></div>
</template>
