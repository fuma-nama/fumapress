<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import { cn } from "../../../../../utils/cn";
import { useDocsPage } from "../../context";

defineOptions({ inheritAttrs: false });

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
const { full } = useDocsPage();
const className = computed(() =>
  cn(
    "flex flex-col min-w-0 w-full max-w-[900px] px-4 py-6 gap-4 md:px-6 md:pt-8 xl:px-8 xl:pt-14",
    full.value && "max-w-[1200px]",
    props.class,
  ),
);
</script>

<template>
  <main class="grid [grid-area:main] justify-items-center" data-layout-main="">
    <article
      data-layout-content=""
      :data-full="full"
      v-bind="$attrs"
      id="nd-page"
      :class="className"
    >
      <slot />
    </article>
  </main>
</template>
