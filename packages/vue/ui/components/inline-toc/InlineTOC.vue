<script setup lang="ts">
import { computed } from "vue";
import { ChevronDown } from "lucide-vue-next";
import { useTranslations } from "../../core/translate";
import { cn } from "../../utils/cn";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";
import type { InlineTocProps } from "./index";

const props = defineProps<InlineTocProps>();
const t = useTranslations({ note: "inline table of contents" });
const className = computed(() =>
  cn("not-prose rounded-lg border bg-fd-card text-fd-card-foreground", props.class),
);
</script>

<template>
  <Collapsible :class="className">
    <CollapsibleTrigger
      class="group inline-flex w-full items-center justify-between px-4 py-2.5 font-medium"
    >
      <slot>{{ t("Table of Contents") }}</slot>
      <ChevronDown
        class="size-4 transition-transform duration-200 group-data-[state=open]:rotate-180"
      />
    </CollapsibleTrigger>
    <CollapsibleContent>
      <div class="flex flex-col p-4 pt-0 text-sm text-fd-muted-foreground">
        <a
          v-for="item in items"
          :key="item.url"
          :href="item.url"
          class="border-s py-1.5 hover:text-fd-accent-foreground"
          :style="{ paddingInlineStart: `${12 * Math.max(item.depth - 1, 0)}px` }"
        >
          {{ item.title }}
        </a>
      </div>
    </CollapsibleContent>
  </Collapsible>
</template>
