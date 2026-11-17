<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import { AccordionContent as Content } from "@fumapress/vue/reka/accordion";
import { cn } from "../../../utils/cn";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
const className = computed(() =>
  cn(
    "overflow-hidden data-[state=closed]:animate-fd-accordion-up data-[state=open]:animate-fd-accordion-down",
    props.class,
  ),
);
</script>

<template>
  <Content :class="className">
    <slot />
  </Content>
</template>
