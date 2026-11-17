<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import { NavigationMenuTrigger } from "@fumapress/vue/reka/navigation-menu";
import { cn } from "../../../utils/cn";
import { navItemVariants } from "../slots/header";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
const className = computed(() => cn(navItemVariants(), "text-sm rounded-md", props.class));
</script>

<template>
  <NavigationMenuTrigger :class="className">
    <slot />
  </NavigationMenuTrigger>
</template>
