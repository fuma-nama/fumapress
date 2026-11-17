<script setup lang="ts">
import { computed } from "vue";
import { TextIcon } from "../../../../../icons";
import * as Base from "../../../../../components/toc";
import { useTranslations } from "../../../../../core/translate";
import { cn } from "../../../../../utils/cn";
import { useSpaciousLayout } from "../../../context";
import type { TOCProps } from "./index";
import TOCList from "./TOCList.vue";

defineOptions({ inheritAttrs: false });

const props = defineProps<TOCProps>();
const t = useTranslations({ note: "table of contents" });
const items = Base.useTOCItems();
const { props: layout } = useSpaciousLayout();
const className = computed(() => {
  const aiChat = layout.value.aiChat;

  return cn(
    "sticky top-0 flex flex-col shrink-0 w-(--fd-toc-width) h-full ps-16 pt-8 pb-4 overflow-clip *:min-w-[calc(var(--fd-toc-width)---spacing(16))] layout:[--fd-toc-width:--spacing(76)] transition-[width,padding,opacity,visibility] duration-300 ease-in-out motion-reduce:transition-none max-md:hidden",
    // collapse along with AI chat
    aiChat?.open && aiChat.panel
      ? "invisible w-0 ps-0 opacity-0"
      : // not animated, container queries may resolve after the initial render
        "@max-5xl:invisible @max-5xl:w-0 @max-5xl:ps-0 @max-5xl:opacity-0 @max-5xl:transition-none",
    props.container?.class,
  );
});
</script>

<template>
  <div
    v-if="items.length > 0 || $slots.header || $slots.footer"
    id="nd-toc"
    v-bind="{ ...container, class: className }"
  >
    <slot name="header" />
    <h3 class="inline-flex items-center gap-1.5 text-sm text-fd-muted-foreground">
      <TextIcon class="size-4" />{{ t("On this page") }}
    </h3>
    <TOCList :style="props.style" :list="props.list" />
    <slot name="footer" />
  </div>
</template>
