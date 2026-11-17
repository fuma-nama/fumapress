<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import { NavigationMenuItem } from "reka-ui";
import { cn } from "../../../utils/cn";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
const className = computed(() => cn("list-none", props.class));
</script>

<template>
  <NavigationMenuItem :class="className">
    <slot />
  </NavigationMenuItem>
</template>
