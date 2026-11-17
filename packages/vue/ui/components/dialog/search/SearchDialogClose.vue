<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import { useTranslations } from "../../../core/translate";
import { cn } from "../../../utils/cn";
import { buttonVariants } from "../../ui/button";
import { useSearch } from "./context";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
const { onOpenChange } = useSearch();
const t = useTranslations({ note: "search dialog" });
const className = computed(() =>
  cn(
    buttonVariants({
      variant: "outline",
      size: "sm",
      className: "font-mono text-fd-muted-foreground",
    }),
    props.class,
  ),
);
</script>

<template>
  <button type="button" :class="className" @click="onOpenChange(false)">
    <slot>ESC</slot>
    <span class="sr-only">{{ t("Close Search", { note: "aria-label" }) }}</span>
  </button>
</template>
