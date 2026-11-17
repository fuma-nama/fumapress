<script setup lang="ts">
import { computed } from "vue";
import { ChevronLeft, ChevronRight } from "lucide-vue-next";
import type * as PageTree from "@fumapress/vue/page-tree";
import { Link } from "../../../../../core/link";
import { useTranslations } from "../../../../../core/translate";
import { cn } from "../../../../../utils/cn";

const props = defineProps<{
  item: Pick<PageTree.Item, "name" | "description" | "url">;
  index: 0 | 1;
}>();
const t = useTranslations({ note: "pagination" });
const Icon = computed(() => (props.index === 0 ? ChevronLeft : ChevronRight));
const linkClass = computed(() =>
  cn(
    "flex flex-col gap-2 rounded-lg border p-4 text-sm transition-colors hover:bg-fd-accent/80 hover:text-fd-accent-foreground @max-lg:col-span-full",
    props.index === 1 && "text-end",
  ),
);
const titleClass = computed(() =>
  cn("inline-flex items-center gap-1.5 font-medium", props.index === 1 && "flex-row-reverse"),
);
</script>

<template>
  <Link :href="item.url" :class="linkClass">
    <div :class="titleClass">
      <component :is="Icon" class="-mx-1 size-4 shrink-0 rtl:rotate-180" />
      <p>{{ item.name }}</p>
    </div>
    <p class="text-fd-muted-foreground truncate">
      {{ item.description ?? (index === 0 ? t("Previous Page") : t("Next Page")) }}
    </p>
  </Link>
</template>
