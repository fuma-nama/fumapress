<script setup lang="ts">
import { computed } from "vue";
import { cn } from "../../../utils/cn";
import { useTOCItems } from "..";
import type { TOCItemsProps } from "./index";
import ThumbTrack from "./ThumbTrack.vue";

const props = defineProps<TOCItemsProps>();
const items = useTOCItems();
const className = computed(() => cn("relative flex flex-col", props.class));
</script>

<template>
  <div :class="className">
    <ThumbTrack v-if="items.length > 0" :items="items" />
    <slot />
  </div>
</template>
