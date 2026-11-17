<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import { AccordionHeader as Header } from "reka-ui";
import { cn } from "../../../utils/cn";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
const className = computed(() =>
  cn(
    "scroll-m-24 not-prose flex flex-row items-center text-fd-card-foreground font-medium has-focus-visible:bg-fd-accent",
    props.class,
  ),
);
</script>

<template>
  <Header :class="className">
    <slot />
  </Header>
</template>
