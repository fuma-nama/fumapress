<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import { cn } from "../../../utils/cn";

/**
 * Add typography styles
 */
const props = defineProps<{ class?: HTMLAttributes["class"] }>();
const className = computed(() => cn("prose flex-1", props.class));
</script>

<template>
  <div :class="className"><slot /></div>
</template>
