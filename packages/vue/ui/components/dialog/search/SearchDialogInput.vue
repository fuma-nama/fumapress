<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import { useTranslations } from "../../../core/translate";
import { cn } from "../../../utils/cn";
import { useSearch } from "./context";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
const t = useTranslations({ note: "search dialog" });
const { search, onSearchChange, getActive } = useSearch();
const active = computed(getActive);
const className = computed(() =>
  cn(
    "w-0 flex-1 bg-transparent text-lg placeholder:text-fd-muted-foreground focus-visible:outline-none",
    props.class,
  ),
);
</script>

<template>
  <input
    data-fd-search-dialog-input=""
    role="combobox"
    :aria-expanded="active !== null"
    :aria-activedescendant="active !== null ? `fd-search-option-${active}` : undefined"
    :aria-label="t('Search')"
    aria-autocomplete="list"
    aria-controls="fd-search-list"
    :value="search"
    :placeholder="t('Search')"
    :class="className"
    @input="onSearchChange(($event.target as HTMLInputElement).value)"
  />
</template>
