<script setup lang="ts">
import { computed } from "vue";
import { Text } from "lucide-vue-next";
import * as Base from "../../../../../components/toc";
import { useTranslations } from "../../../../../core/translate";
import { cn } from "../../../../../utils/cn";
import { useNotebookLayout } from "../../../client";
import { variants } from "./context";
import type { TOCProps } from "./index";

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<TOCProps>(), { style: "normal" });
const t = useTranslations({ note: "table of contents" });
const items = Base.useTOCItems();
const variant = computed(() => variants[props.style]);
const { props: layout } = useNotebookLayout();
const className = computed(() =>
  cn(
    "sticky top-(--fd-docs-row-3) [grid-area:toc] h-[calc(var(--fd-docs-height)-var(--fd-docs-row-3))] flex flex-col w-(--fd-toc-width) pt-12 pe-4 pb-2 xl:layout:[--fd-toc-width:268px] max-xl:hidden",
    // AI chat takes its place
    "transition-[opacity,visibility] duration-300",
    layout.value.aiChat?.open && layout.value.aiChat.panel && "invisible opacity-0",
    props.container?.class,
  ),
);
</script>

<template>
  <div
    v-if="items.length === 0 && !$slots.footer && !$slots.header"
    id="nd-toc-placeholder"
    class="hidden xl:layout:[--fd-toc-width:268px]"
  />
  <div v-else id="nd-toc" v-bind="{ ...container, class: className }">
    <slot name="header" />
    <h3 id="toc-title" class="inline-flex items-center gap-1.5 text-sm text-fd-muted-foreground">
      <Text class="size-4" />{{ t("On this page") }}
    </h3>
    <Base.TOCScrollArea class="ms-px">
      <component :is="variant.TOCItems" v-bind="list">
        <component :is="variant.TOCEmpty" v-if="items.length === 0" />
        <component :is="variant.TOCItem" v-for="item in items" :key="item.url" :item="item" />
      </component>
    </Base.TOCScrollArea>
    <slot name="footer" />
  </div>
</template>
