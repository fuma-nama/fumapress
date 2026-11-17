<script setup lang="ts">
import { computed, provide, toRef } from "vue";
import { cn } from "../../../utils/cn";
import { RenderNode } from "../../shared";
import { PageKey } from "./context";
import type { DocsPageProps } from "./index";
import { Breadcrumb } from "./slots/breadcrumb";
import { Footer } from "./slots/footer";
import { TOC, TOCProvider } from "./slots/toc";

// the source reads none of the other props
defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<DocsPageProps>(), { full: false, toc: () => [] });

provide(PageKey, { full: toRef(props, "full") });

const className = computed(() =>
  cn(
    "flex flex-col gap-2 p-6 pb-16 min-w-0 [grid-area:main] md:pt-16 md:pb-8",
    props.full && "layout:[--fd-main-width:1200px]",
  ),
);
const tocProps = computed(() => {
  const { header: _header, footer: _footer, ...rest } = props.tableOfContent ?? {};
  return rest;
});
</script>

<template>
  <TOCProvider :toc="toc">
    <main id="nd-page" :data-fd-full="full" :class="className">
      <Breadcrumb />
      <slot />
      <Footer />
    </main>
    <TOC v-bind="tocProps">
      <template v-if="tableOfContent?.header" #header>
        <RenderNode :node="tableOfContent.header" />
      </template>
      <template v-if="tableOfContent?.footer" #footer>
        <RenderNode :node="tableOfContent.footer" />
      </template>
    </TOC>
  </TOCProvider>
</template>
