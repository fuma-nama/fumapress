<script setup lang="ts">
import { computed } from "vue";
import { Search } from "lucide-vue-next";
import { buttonVariants } from "../../../../components/ui/button";
import { useSearchContext } from "../../../../contexts/search";
import { useTranslations } from "../../../../core/translate";
import { cn } from "../../../../utils/cn";
import type { SearchTriggerProps } from "./index";

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<SearchTriggerProps>(), { size: "icon-sm" });
const { setOpenSearch, enabled } = useSearchContext();
const t = useTranslations({ note: "search trigger" });
const label = computed(() => t("Open Search", { note: "aria-label" }));
const className = computed(() =>
  cn(
    buttonVariants({
      size: props.size,
      variant: props.variant === undefined ? (props.color ?? "ghost") : props.variant,
    }),
    props.class,
  ),
);
</script>

<template>
  <button
    v-if="!(hideIfDisabled && !enabled)"
    type="button"
    :class="className"
    data-search=""
    :aria-label="label"
    @click="setOpenSearch(true)"
  >
    <Search />
  </button>
</template>
