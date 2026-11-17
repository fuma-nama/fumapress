<script setup lang="ts">
import type { VNode } from "vue";
import CalloutContainer from "./CalloutContainer.vue";
import CalloutDescription from "./CalloutDescription.vue";
import CalloutTitle from "./CalloutTitle.vue";

// the other props of the container (`type`, `icon`, `class`) reach it as attributes
const props = defineProps<{ title?: string | VNode }>();
const Title = () => props.title;
</script>

<template>
  <CalloutContainer>
    <template v-if="$slots.icon" #icon><slot name="icon" /></template>
    <CalloutTitle v-if="title || $slots.title">
      <slot name="title"><Title /></slot>
    </CalloutTitle>
    <CalloutDescription><slot /></CalloutDescription>
  </CalloutContainer>
</template>
