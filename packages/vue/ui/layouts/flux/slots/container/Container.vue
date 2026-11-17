<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import { cn } from "../../../../utils/cn";

defineOptions({ inheritAttrs: false });

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
const className = computed(() =>
  cn("flex flex-col items-center pb-24 overflow-x-clip", props.class),
);
</script>

<template>
  <div id="nd-flux-layout" v-bind="$attrs" :class="className">
    <slot />
  </div>
</template>
