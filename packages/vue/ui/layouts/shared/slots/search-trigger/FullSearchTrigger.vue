<script setup lang="ts">
import { computed } from "vue";
import { Search } from "../../../../icons";
import { useSearchContext } from "../../../../contexts/search";
import { useTranslations } from "../../../../core/translate";
import { cn } from "../../../../utils/cn";
import RenderNode from "../../RenderNode.vue";
import type { FullSearchTriggerProps } from "./index";

const props = defineProps<FullSearchTriggerProps>();
const { enabled, hotKey, setOpenSearch } = useSearchContext();
const t = useTranslations({ note: "search trigger" });
const className = computed(() =>
  cn(
    "inline-flex items-center gap-2 rounded-lg border bg-fd-secondary/50 p-1.5 ps-2 text-sm text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground",
    props.class,
  ),
);
</script>

<template>
  <button
    v-if="!(hideIfDisabled && !enabled)"
    type="button"
    data-search-full=""
    :class="className"
    @click="setOpenSearch(true)"
  >
    <Search class="size-4" />{{ t("Search") }}
    <div class="ms-auto inline-flex gap-0.5">
      <kbd v-for="(k, i) in hotKey" :key="i" class="rounded-md border bg-fd-background px-1.5">
        <RenderNode :node="k.display" />
      </kbd>
    </div>
  </button>
</template>
