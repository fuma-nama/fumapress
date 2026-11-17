<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import { cn } from "../../../utils/cn";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
const className = computed(() => cn("flex flex-row items-center gap-2 p-3", props.class));
</script>

<template>
  <div :class="className">
    <slot />
  </div>
</template>
