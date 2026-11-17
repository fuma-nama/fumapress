<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import { cn } from "../../utils/cn";
import { TabsList as UnstyledTabsList } from "../ui/tabs";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
const className = computed(() =>
  cn("flex gap-3.5 text-fd-secondary-foreground overflow-x-auto px-4 not-prose", props.class),
);
</script>

<template>
  <UnstyledTabsList :class="className">
    <slot />
  </UnstyledTabsList>
</template>
