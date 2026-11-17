<script setup lang="ts">
import {
  computed,
  onMounted,
  useTemplateRef,
  watch,
  type HTMLAttributes,
  type VNodeChild,
} from "vue";
import scrollIntoView from "scroll-into-view-if-needed";
import { ChevronRight, Hash } from "lucide-vue-next";
import { useHighlightQuery, type SearchResultTable } from "../../../core/search/client";
import { cn } from "../../../utils/cn";
import { useSearch } from "./context";
import { toJsx } from "../../../core/utils/hast-to-jsx";
import type { SearchItemType } from "./index";
import { renderOptions, rowRenderOptions, tableRenderOptions } from "./markdown";

const props = defineProps<{
  class?: HTMLAttributes["class"];
  /** the table of a row */
  table?: SearchResultTable;
  item: SearchItemType;
}>();
const slots = defineSlots<{
  default?: () => VNodeChild;
  /** render the Markdown `content` of items, instead of their `hastContent` */
  renderMarkdown?: (props: { content: string }) => VNodeChild;
}>();

const element = useTemplateRef<HTMLDivElement>("element");
const { query, getActive, setActive } = useSearch();
const active = computed(() => getActive() === props.item.id);
const highlightRef = useHighlightQuery(query);
const hastContent = computed<VNodeChild>(() => {
  const { item, table } = props;
  if (item.type === "action" || !("hastContent" in item)) return;
  if (!table) return toJsx(item.hastContent, renderOptions);
  return toJsx(item.hastContent, table.header ? rowRenderOptions : tableRenderOptions);
});

/** called while rendering, as it calls a slot */
function content(): VNodeChild {
  const { item } = props;
  if (item.type === "action") return item.node;
  if (slots.renderMarkdown && typeof item.content === "string")
    return slots.renderMarkdown({ content: item.content });
  if (!("hastContent" in item)) return item.content;
  return hastContent.value;
}

function Render({ node }: { node: VNodeChild }): VNodeChild {
  return node;
}

const className = computed(() =>
  cn(
    "cursor-default",
    props.table
      ? "col-span-full grid grid-cols-subgrid items-baseline px-3 py-1.5 not-first:border-t"
      : "relative shrink-0 px-2.5 py-2 text-sm overflow-hidden rounded-lg",
    active.value && "bg-fd-accent text-fd-accent-foreground",
    props.class,
  ),
);
const rowClassName = computed(() =>
  cn(
    "contents",
    // rows without header, like the props of type tables
    !props.table?.header &&
      "*:first:font-medium *:first:text-fd-primary *:nth-2:text-xs *:not-first:text-fd-muted-foreground",
  ),
);
const contentClassName = computed(() => {
  const { type } = props.item;

  return cn(
    "prose prose-sm min-w-0",
    type === "text" && "ps-4",
    type === "heading" && "ps-8",
    type === "page" || type === "heading"
      ? "font-medium text-inherit"
      : "text-fd-popover-foreground/80",
  );
});

onMounted(() => {
  watch(
    active,
    (active) => {
      if (active && element.value) {
        scrollIntoView(element.value, {
          scrollMode: "if-needed",
          block: "nearest",
          boundary: element.value.closest('[role="listbox"]'),
        });
      }
    },
    { immediate: true, flush: "post" },
  );
});
</script>

<template>
  <div
    :id="`fd-search-option-${item.id}`"
    ref="element"
    role="option"
    :aria-selected="active"
    :class="className"
    @pointermove="setActive(item.id)"
  >
    <slot>
      <Render v-if="item.type === 'action'" :node="content()" />
      <div v-else-if="table" :ref="highlightRef" :class="rowClassName">
        <Render :node="content()" />
      </div>
      <template v-else>
        <div class="inline-flex items-center text-fd-muted-foreground text-xs empty:hidden">
          <template v-for="(breadcrumb, i) in item.breadcrumbs" :key="i">
            <ChevronRight v-if="i > 0" class="size-4 rtl:rotate-180" />
            <Render :node="breadcrumb" />
          </template>
        </div>

        <div
          v-if="item.type !== 'page'"
          role="none"
          class="absolute inset-s-3 inset-y-0 w-px bg-fd-border"
        />
        <Hash
          v-if="item.type === 'heading'"
          class="absolute inset-s-6 top-2.5 size-4 text-fd-muted-foreground"
        />
        <div :ref="highlightRef" :class="contentClassName">
          <Render :node="content()" />
        </div>
      </template>
    </slot>
  </div>
</template>
