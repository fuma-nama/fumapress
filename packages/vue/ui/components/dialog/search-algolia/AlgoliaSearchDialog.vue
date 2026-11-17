<script setup lang="ts">
import { computed, shallowRef } from "vue";
import type { SortedResult } from "../../../core/search";
import { useAlgoliaSearch } from "../../../core/search/client/algolia";
import { useOnChange } from "../../../core/utils/use-on-change";
import { useI18n } from "../../../contexts/i18n";
import {
  SearchDialog,
  SearchDialogClose,
  SearchDialogContent,
  SearchDialogFooter,
  SearchDialogHeader,
  SearchDialogIcon,
  SearchDialogInput,
  SearchDialogList,
  SearchDialogOverlay,
  TagsList,
  TagsListItem,
} from "../search";
import type { AlgoliaSearchDialogProps } from "./index";

const props = withDefaults(defineProps<AlgoliaSearchDialogProps>(), {
  tags: () => [],
  showAlgolia: false,
  allowClear: false,
  links: () => [],
});
const emit = defineEmits<{ "update:open": [open: boolean] }>();

const tag = shallowRef(props.defaultTag);
const { locale } = useI18n();
const { search, onSearchChange, isLoading, data, error } = useAlgoliaSearch(() => ({
  tag: tag.value,
  locale: locale.value,
  ...props.searchOptions,
}));
const defaultItems = computed<SortedResult[] | null>(() => {
  if (props.links.length === 0) return null;
  return props.links.map(([name, link]) => ({
    type: "page",
    id: name,
    content: name,
    url: link,
  }));
});

useOnChange(
  () => props.defaultTag,
  (v) => {
    tag.value = v;
  },
);
</script>

<template>
  <SearchDialog
    :search="search"
    :is-loading="isLoading"
    :data="data"
    :error="error"
    :open="open"
    @update:search="onSearchChange"
    @update:open="emit('update:open', $event)"
  >
    <SearchDialogOverlay />
    <SearchDialogContent>
      <SearchDialogHeader>
        <SearchDialogIcon />
        <SearchDialogInput />
        <SearchDialogClose />
      </SearchDialogHeader>
      <SearchDialogList :default-items="defaultItems" />
    </SearchDialogContent>
    <SearchDialogFooter>
      <TagsList v-if="tags.length > 0" v-model:tag="tag" :allow-clear="allowClear">
        <TagsListItem v-for="item in tags" :key="item.value" :value="item.value">
          {{ item.name }}
        </TagsListItem>
        <a
          v-if="showAlgolia"
          href="https://algolia.com"
          rel="noreferrer noopener"
          class="ms-auto text-xs text-fd-muted-foreground"
        >
          Search powered by Algolia
        </a>
      </TagsList>
      <a
        v-else-if="showAlgolia"
        href="https://algolia.com"
        rel="noreferrer noopener"
        class="ms-auto text-xs text-fd-muted-foreground"
      >
        Search powered by Algolia
      </a>
      <slot name="footer" />
    </SearchDialogFooter>
  </SearchDialog>
</template>
