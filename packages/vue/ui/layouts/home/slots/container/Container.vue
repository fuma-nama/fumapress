<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import { cn } from "../../../../utils/cn";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
const className = computed(() =>
  cn("flex flex-1 flex-col [--fd-layout-width:1400px]", props.class),
);
</script>

<template>
  <main id="nd-home-layout" :class="className">
    <slot />
  </main>
</template>
