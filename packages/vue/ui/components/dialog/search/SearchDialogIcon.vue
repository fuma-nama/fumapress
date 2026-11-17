<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import { SearchIcon } from "../../../icons";
import { cn } from "../../../utils/cn";
import { useSearch } from "./context";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
const { isLoading } = useSearch();
const className = computed(() =>
  cn(
    "size-5 text-fd-muted-foreground",
    isLoading.value && "animate-pulse duration-400",
    props.class,
  ),
);
</script>

<template>
  <SearchIcon :class="className" />
</template>
