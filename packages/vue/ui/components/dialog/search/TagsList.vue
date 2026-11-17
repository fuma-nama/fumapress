<script setup lang="ts">
import { computed, provide, toRef, type HTMLAttributes } from "vue";
import { cn } from "../../../utils/cn";
import { TagsListKey } from "./context";
import type { TagsListProps } from "./index";

const props = withDefaults(defineProps<TagsListProps & { class?: HTMLAttributes["class"] }>(), {
  allowClear: false,
});
const emit = defineEmits<{ "update:tag": [tag: string | undefined] }>();
const className = computed(() => cn("flex items-center gap-1 flex-wrap", props.class));

provide(TagsListKey, {
  value: toRef(props, "tag"),
  onValueChange: (v) => emit("update:tag", v),
  allowClear: toRef(props, "allowClear"),
});
</script>

<template>
  <div :class="className">
    <slot />
  </div>
</template>
