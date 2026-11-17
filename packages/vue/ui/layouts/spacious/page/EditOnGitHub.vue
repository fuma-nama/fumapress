<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import { EditIcon } from "lucide-vue-next";
import { buttonVariants } from "../../../components/ui/button";
import { useTranslations } from "../../../core/translate";
import { cn } from "../../../utils/cn";

/** the attributes of an `<a>` */
defineOptions({ inheritAttrs: false });

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
const t = useTranslations({ note: "edit page" });
const className = computed(() =>
  cn(buttonVariants({ variant: "secondary", size: "sm" }), "gap-1.5 not-prose", props.class),
);
</script>

<template>
  <a target="_blank" rel="noreferrer noopener" v-bind="$attrs" :class="className">
    <slot><EditIcon class="size-3.5" />{{ t("Edit on GitHub") }}</slot>
  </a>
</template>
