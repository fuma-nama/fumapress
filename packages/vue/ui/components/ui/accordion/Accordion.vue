<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import { AccordionRoot as Root } from "reka-ui";
import { cn } from "../../../utils/cn";

// `collapsible`: an open item of Base UI can always be closed
const props = defineProps<{ class?: HTMLAttributes["class"] }>();
const className = computed(() =>
  cn("divide-y divide-fd-border overflow-hidden rounded-lg border bg-fd-card", props.class),
);
</script>

<template>
  <Root collapsible :class="className">
    <slot />
  </Root>
</template>
