<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import { cn } from "../utils/cn";

/**
 * For separate MDX page
 */
const props = defineProps<{ class?: HTMLAttributes["class"] }>();
const className = computed(() => cn("w-full max-w-[1400px] mx-auto px-4 py-12", props.class));
</script>

<template>
  <main :class="className">
    <article class="prose"><slot /></article>
  </main>
</template>
