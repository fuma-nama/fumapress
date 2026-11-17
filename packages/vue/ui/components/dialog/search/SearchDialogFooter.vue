<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import { cn } from "../../../utils/cn";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
const className = computed(() => cn("bg-fd-secondary/50 p-3 empty:hidden", props.class));
</script>

<template>
  <div :class="className"><slot /></div>
</template>
