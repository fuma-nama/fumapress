<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import { cn } from "../../utils/cn";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
const className = computed(() => cn("not-prose rounded-md border bg-fd-card p-2", props.class));
</script>

<template>
  <div :class="className"><slot /></div>
</template>
