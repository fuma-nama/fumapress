<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import { Edit } from "lucide-vue-next";
import { buttonVariants } from "../../../components/ui/button";
import { useTranslations } from "../../../core/translate";
import { cn } from "../../../utils/cn";

// the other attributes of the `<a>` reach it
const props = defineProps<{ class?: HTMLAttributes["class"] }>();
const t = useTranslations({ note: "edit page" });
const className = computed(() =>
  cn(
    buttonVariants({
      variant: "secondary",
      size: "sm",
    }),
    "gap-1.5 not-prose",
    props.class,
  ),
);
</script>

<template>
  <a target="_blank" rel="noreferrer noopener" :class="className">
    <slot><Edit class="size-3.5" />{{ t("Edit on GitHub") }}</slot>
  </a>
</template>
