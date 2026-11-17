<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import { CollapsibleContent as Content } from "reka-ui";
import { cn } from "../../../utils/cn";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
const className = computed(() =>
  cn(
    "overflow-hidden [&[hidden]:not([hidden='until-found'])]:hidden data-[state=closed]:animate-fd-collapsible-up data-[state=open]:animate-fd-collapsible-down",
    props.class,
  ),
);
</script>

<template>
  <Content :class="className">
    <slot />
  </Content>
</template>
