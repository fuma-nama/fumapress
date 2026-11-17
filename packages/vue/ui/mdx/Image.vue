<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import { Image as FrameworkImage } from "../core/framework";
import { cn } from "../utils/cn";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
const className = computed(() => cn("rounded-lg", props.class));
</script>

<template>
  <FrameworkImage
    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 70vw, 900px"
    :class="className"
  />
</template>
