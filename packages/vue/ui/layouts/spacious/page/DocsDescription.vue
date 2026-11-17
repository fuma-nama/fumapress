<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import { cn } from "../../../utils/cn";

/** not rendered without the default slot */
const props = defineProps<{ class?: HTMLAttributes["class"] }>();
const className = computed(() => cn("mb-8 text-lg text-fd-muted-foreground", props.class));
</script>

<template>
  <p v-if="$slots.default" :class="className">
    <slot />
  </p>
</template>
