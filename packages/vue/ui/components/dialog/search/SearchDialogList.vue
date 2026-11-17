<script setup lang="ts">
import {
  computed,
  h,
  onBeforeUnmount,
  onMounted,
  useTemplateRef,
  watch,
  type FunctionalComponent,
  type HTMLAttributes,
  type VNodeChild,
} from "vue";
import { CircleAlert } from "../../../icons";
import type { SearchResultItem, SearchResultTable } from "../../../core/search/client";
import { T, useTranslations } from "../../../core/translate";
import { cn } from "../../../utils/cn";
import { useSearch, type ItemRendererProps } from "./context";
import type { SearchItemType } from "./index";
import SearchDialogListItem from "./SearchDialogListItem.vue";
import SearchDialogListTable from "./SearchDialogListTable.vue";

const props = withDefaults(
  defineProps<{
    class?: HTMLAttributes["class"];
    /** @defaultValue the results of `data` from `<SearchDialog />` */
    items?: (SearchItemType | SearchResultItem)[] | null;
    /** shown without results */
    defaultItems?: (SearchItemType | SearchResultItem)[] | null;
  }>(),
  { defaultItems: null },
);
const slots = defineSlots<{
  /**
   * Renderer for empty list UI
   */
  Empty?: () => VNodeChild;
  /**
   * Renderer for items
   */
  Item?: (props: ItemRendererProps) => VNodeChild;
  /**
   * Renderer for tables, `Item` and `onSelect` render their rows
   */
  Table?: (props: {
    table: SearchResultTable;
    Item: FunctionalComponent<ItemRendererProps>;
    onSelect: (item: SearchItemType) => void;
  }) => VNodeChild;
}>();

const element = useTemplateRef<HTMLDivElement>("element");
const t = useTranslations({ note: "search dialog" });
const { onSelect, data, error, getActive, setActive } = useSearch();
const items = computed(() =>
  props.items === undefined ? (data.value?.items ?? props.defaultItems) : props.items,
);
const className = computed(() =>
  cn(
    "overflow-hidden h-(--fd-animated-height) transition-[height] [&_::highlight(fd-search)]:text-fd-primary [&_::highlight(fd-search)]:underline",
    props.class,
  ),
);
const statusClassName = computed(() =>
  cn("truncate text-sm not-empty:p-3", items.value && "not-empty:border-b"),
);
const listClassName = computed(() =>
  cn("w-full flex flex-col overflow-y-auto max-h-[460px] p-1", !items.value && "hidden"),
);

/** the `Item` slot, `<SearchDialogListItem />` without it */
const Item: FunctionalComponent<ItemRendererProps> = (props) =>
  slots.Item ? slots.Item(props) : h(SearchDialogListItem, props);
Item.inheritAttrs = false;

watch([items, error], ([items, error]) => setActive(error ? null : (items?.[0]?.id ?? null)), {
  immediate: true,
});

function onKey(e: KeyboardEvent) {
  if (!items.value || e.isComposing || e.keyCode === 229) return;
  const list = flattenItems(items.value);

  if (e.key === "ArrowDown" || e.key == "ArrowUp") {
    let idx = list.findIndex((item) => item.id === getActive());
    if (idx === -1) idx = 0;
    else if (e.key === "ArrowDown") idx++;
    else idx--;

    setActive(list.at(idx % list.length)?.id ?? null);
    e.preventDefault();
  }

  if (e.key === "Enter") {
    const selected = list.find((item) => item.id === getActive());

    if (selected) onSelect(selected);
    e.preventDefault();
  }
}

let cleanup: (() => void) | undefined;

onMounted(() => {
  const list = element.value;
  if (!list) return;

  const observer = new ResizeObserver(() => {
    let height = 0;
    for (const child of list.children) height += (child as HTMLElement).offsetHeight;

    list.style.setProperty("--fd-animated-height", `${height}px`);
  });

  for (const child of list.children) observer.observe(child);

  const content: Pick<Window, "addEventListener" | "removeEventListener"> =
    document.getElementById("fd-search-dialog-content") ?? window;
  content.addEventListener("keydown", onKey);
  cleanup = () => {
    observer.disconnect();
    content.removeEventListener("keydown", onKey);
  };
});

onBeforeUnmount(() => cleanup?.());

function flattenItems(items: (SearchItemType | SearchResultItem)[]): SearchItemType[] {
  const out: SearchItemType[] = [];
  for (const item of items) {
    if (item.type === "table") out.push(...item.rows);
    else out.push(item);
  }

  return out;
}
</script>

<template>
  <div ref="element" :data-empty="items === null && !error" :class="className">
    <p role="status" :class="statusClassName">
      <template v-if="error">
        <CircleAlert class="inline size-5 me-2 align-top text-fd-error" />
        <T v-if="data" text="Search failed, showing results for {query}" note="search dialog">
          <template #query>
            <span class="font-medium">{{ data.query }}</span>
          </template>
        </T>
        <T v-else text="Search failed" note="search dialog" />
      </template>
    </p>
    <!-- an empty listbox is invalid, expose it only with options -->
    <div
      id="fd-search-list"
      :role="items?.length ? 'listbox' : undefined"
      :aria-label="items?.length ? t('Search') : undefined"
      :class="listClassName"
    >
      <slot v-if="items?.length === 0" name="Empty">
        <div role="status" class="py-12 text-center text-sm text-fd-muted-foreground">
          <T text="No results found" note="search dialog" />
        </div>
      </slot>

      <template v-for="item in items" :key="item.id">
        <slot
          v-if="item.type === 'table'"
          name="Table"
          :table="item"
          :Item="Item"
          :onSelect="onSelect"
        >
          <SearchDialogListTable :table="item" @select="onSelect">
            <template #Item="row">
              <Item v-bind="row" />
            </template>
          </SearchDialogListTable>
        </slot>
        <Item v-else :item="item" :onClick="() => onSelect(item)" />
      </template>
    </div>
  </div>
</template>
