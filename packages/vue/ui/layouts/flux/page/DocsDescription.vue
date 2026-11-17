<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import { cn } from "../../../utils/cn";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
const className = computed(() => cn("mb-8 text-lg text-fd-muted-foreground", props.class));
// Don't render if no description provided
</script>

<template>
  <p v-if="$slots.default" :class="className">
    <slot />
  </p>
</template>
