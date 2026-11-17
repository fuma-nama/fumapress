<script setup lang="ts">
import { computed, shallowRef } from "vue";
import { searchIndexPath, usePress } from "@fumapress/vue/client";
import type { SortedResult } from "../../../core/search";
import { useDocsSearch } from "../../../core/search/client";
import { fetchClient } from "../../../core/search/client/fetch";
import { staticClient } from "../../../core/search/client/static";
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
import type { DefaultSearchDialogProps } from "./index";

const props = withDefaults(defineProps<DefaultSearchDialogProps>(), {
  tags: () => [],
  allowClear: false,
  links: () => [],
});
const emit = defineEmits<{ "update:open": [open: boolean] }>();

const { locale } = useI18n();
const { load, lang } = usePress();
const tag = shallowRef(props.defaultTag);
const { search, onSearchChange, isLoading, data, error } = useDocsSearch(() => ({
  client:
    props.type === "static"
      ? staticClient(load, props.api ?? searchIndexPath(lang))
      : fetchClient({
          api: props.api,
          locale: locale.value,
          tag: tag.value,
        }),
  delayMs: props.delayMs,
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
      </TagsList>
      <slot name="footer" />
    </SearchDialogFooter>
  </SearchDialog>
</template>
