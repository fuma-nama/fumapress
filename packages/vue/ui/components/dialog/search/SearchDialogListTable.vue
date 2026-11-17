<script setup lang="ts">
import { computed, type VNodeChild } from "vue";
import { useHighlightQuery, type SearchResultTable } from "../../../core/search/client";
import { useSearch, type ItemRendererProps } from "./context";
import { toJsx } from "../../../core/utils/hast-to-jsx";
import type { SearchItemType } from "./index";
import { tableRenderOptions } from "./markdown";

const props = defineProps<{ table: SearchResultTable }>();
const emit = defineEmits<{ select: [item: SearchItemType] }>();
defineSlots<{
  /** renders a row */
  Item: (props: ItemRendererProps) => VNodeChild;
}>();

const { query } = useSearch();
const highlightRef = useHighlightQuery(query);
// the header names the rows
const headerId = computed(() => `fd-search-table-${props.table.id}`);
const header = computed(() => props.table.header && toJsx(props.table.header, tableRenderOptions));
const Header = () => header.value;
const gridTemplateColumns = computed(
  () => `${"fit-content(30%) ".repeat(props.table.columns - 1)}minmax(30%, 1fr)`,
);
</script>

<template>
  <div
    :role="table.header ? 'group' : undefined"
    :aria-labelledby="table.header ? headerId : undefined"
    class="ms-3 shrink-0 border-s py-2 ps-3.25 pe-2.5"
  >
    <div
      class="grid gap-x-3 overflow-hidden rounded-lg border bg-fd-card text-sm"
      :style="{ gridTemplateColumns }"
    >
      <div
        v-if="header"
        :id="headerId"
        :ref="highlightRef"
        aria-hidden="true"
        class="col-span-full grid grid-cols-subgrid bg-fd-secondary px-3 py-1 text-xs text-fd-muted-foreground"
      >
        <Header />
      </div>
      <template v-for="row in table.rows" :key="row.id">
        <slot name="Item" :item="row" :table="table" :onClick="() => emit('select', row)" />
      </template>
    </div>
  </div>
</template>
