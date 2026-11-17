<script setup lang="ts">
import { computed, onMounted, shallowRef, useTemplateRef, watch } from "vue";
import { ChevronDownIcon } from "../../../../../icons";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../../../../components/ui/collapsible";
import { useTreePath } from "../../../../../contexts/tree";
import { useTranslations } from "../../../../../core/translate";
import { cn } from "../../../../../utils/cn";
import ActiveHeading from "./ActiveHeading.vue";
import type { TOCPopoverProps } from "./index";
import TOCList from "./TOCList.vue";
import TOCProgress from "./TOCProgress.vue";

/** the TOC bar for mobile */
defineOptions({ inheritAttrs: false });

const props = defineProps<TOCPopoverProps>();
const t = useTranslations({ note: "table of contents" });
const path = useTreePath();
const page = computed(() => path.value.at(-1));
const headerRef = useTemplateRef<HTMLElement>("header");
const open = shallowRef(false);

onMounted(() => {
  watch(
    open,
    (value, _, onCleanup) => {
      if (!value) return;
      const onClick = (e: MouseEvent) => {
        if (e.target instanceof Node && !headerRef.value?.contains(e.target)) open.value = false;
      };

      window.addEventListener("click", onClick);
      onCleanup(() => window.removeEventListener("click", onClick));
    },
    { immediate: true },
  );
});

const containerClass = computed(() =>
  cn("max-md:layout:[--fd-toc-popover-height:--spacing(10)]", props.container?.class),
);
const triggerClass = computed(() =>
  cn(
    "flex w-full h-10 items-center gap-2.5 px-4 text-start text-sm text-fd-muted-foreground focus-visible:outline-none",
    props.trigger?.class,
  ),
);
const progressClass = computed(() => cn("shrink-0", open.value && "text-fd-primary"));
const headingClass = computed(() =>
  cn("flex-1 transition-colors", open.value && "text-fd-foreground"),
);
const chevronClass = computed(() =>
  cn("size-4 shrink-0 mx-0.5 transition-transform", open.value && "rotate-180"),
);
</script>

<template>
  <Collapsible v-model:open="open" v-bind="{ ...container, class: containerClass }">
    <!-- not the page banner -->
    <header ref="header" role="none" class="bg-fd-card">
      <CollapsibleTrigger v-bind="{ ...trigger, class: triggerClass }">
        <TOCProgress :size="18" :class="progressClass" />
        <ActiveHeading :class="headingClass">
          <template #fallback>{{ page?.name ?? t("On this page") }}</template>
        </ActiveHeading>
        <ChevronDownIcon :class="chevronClass" />
      </CollapsibleTrigger>
      <CollapsibleContent v-bind="content">
        <div class="flex flex-col px-4 max-h-[50vh]">
          <slot name="header" />
          <TOCList :style="props.style" :list="props.list" @select="open = false" />
          <slot name="footer" />
        </div>
      </CollapsibleContent>
    </header>
  </Collapsible>
</template>
