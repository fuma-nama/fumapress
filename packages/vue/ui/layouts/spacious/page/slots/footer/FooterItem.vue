<script setup lang="ts">
import { computed } from "vue";
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-vue-next";
import type * as PageTree from "@fumapress/vue/page-tree";
import { Link } from "../../../../../core/link";
import { useTranslations } from "../../../../../core/translate";
import { cn } from "../../../../../utils/cn";

type Item = Pick<PageTree.Item, "name" | "description" | "url">;

const props = defineProps<{ item: Item; next: boolean }>();
const t = useTranslations({ note: "pagination" });
const Icon = computed(() => (props.next ? ArrowRightIcon : ArrowLeftIcon));
const className = computed(() =>
  cn(
    "group flex flex-col gap-1 rounded-2xl border p-4 text-sm transition-colors hover:bg-fd-accent/40 @max-md:col-span-full",
    props.next && "col-start-2 items-end text-end",
  ),
);
</script>

<template>
  <Link :href="item.url" :class="className">
    <span class="inline-flex items-center gap-1.5 text-fd-muted-foreground">
      <component
        :is="Icon"
        v-if="!next"
        class="size-3.5 transition-transform group-hover:-translate-x-0.5 rtl:rotate-180"
      />{{ next ? t("Next Page") : t("Previous Page")
      }}<component
        :is="Icon"
        v-if="next"
        class="size-3.5 transition-transform group-hover:translate-x-0.5 rtl:rotate-180"
      />
    </span>
    <span class="font-medium">{{ item.name }}</span>
  </Link>
</template>
