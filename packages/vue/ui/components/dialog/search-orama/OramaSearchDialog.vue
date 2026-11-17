<script setup lang="ts">
import { computed, shallowRef } from "vue";
import type { SortedResult } from "../../../core/search";
import { useOramaCloudSearch } from "../../../core/search/client/orama-cloud";
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
import type { OramaSearchDialogProps } from "./index";

const props = withDefaults(defineProps<OramaSearchDialogProps>(), {
  tags: () => [],
  showOrama: true,
  allowClear: false,
  links: () => [],
});
const emit = defineEmits<{ "update:open": [open: boolean] }>();

const { locale } = useI18n();
const tag = shallowRef(props.defaultTag);
const { search, onSearchChange, isLoading, data, error } = useOramaCloudSearch(() => ({
  client: props.client,
  index: props.index,
  params: props.searchOptions,
  locale: locale.value,
  tag: tag.value,
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
      <SearchDialogFooter>
        <TagsList v-if="tags.length > 0" v-model:tag="tag" :allow-clear="allowClear">
          <TagsListItem v-for="item in tags" :key="item.value" :value="item.value">
            {{ item.name }}
          </TagsListItem>
          <a
            v-if="showOrama"
            href="https://orama.com"
            rel="noreferrer noopener"
            class="ms-auto text-xs text-fd-muted-foreground"
          >
            Search powered by Orama
          </a>
        </TagsList>
        <a
          v-else-if="showOrama"
          href="https://orama.com"
          rel="noreferrer noopener"
          class="ms-auto text-xs text-fd-muted-foreground"
        >
          Search powered by Orama
        </a>
        <slot name="footer" />
      </SearchDialogFooter>
    </SearchDialogContent>
  </SearchDialog>
</template>
