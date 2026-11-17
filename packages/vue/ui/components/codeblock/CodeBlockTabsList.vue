<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import { cn } from "../../utils/cn";
import { TabsList } from "../ui/tabs";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
const className = computed(() =>
  cn("flex flex-row px-2 overflow-x-auto text-fd-muted-foreground", props.class),
);
</script>

<template>
  <TabsList :class="className">
    <slot />
  </TabsList>
</template>
