<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import * as Base from "../../../../components/sidebar/base";
import { cn } from "../../../../utils/cn";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
const depth = Base.useFolderDepth();
const className = computed(() =>
  cn(
    "mb-1.5 px-2.5 text-xs font-medium text-fd-muted-foreground [&_svg]:size-3.5 [&_svg]:shrink-0",
    depth > 0 && "mt-4 first:mt-1",
    props.class,
  ),
);
</script>

<template>
  <Base.SidebarSeparator :class="className">
    <slot />
  </Base.SidebarSeparator>
</template>
