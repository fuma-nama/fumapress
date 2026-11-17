<script setup lang="ts">
import { computed } from "vue";
import Base from "./Base.vue";
import DefaultPre from "./DefaultPre.vue";
import { createHighlighter } from "./highlighter";
import type { DynamicCodeblockProps } from "./index";

const props = withDefaults(defineProps<DynamicCodeblockProps>(), { wrapInSuspense: true });
// the highlighter of the first render
const instance = createHighlighter(props.highlighter);
const components = computed(() => ({ pre: DefaultPre, ...props.options?.components }));
// without `wrapInSuspense`, nothing renders while loading: the `<Suspense>` of the source has no fallback
</script>

<template>
  <Base
    :highlighter="instance"
    :components="components"
    :wrap-in-suspense="wrapInSuspense"
    :lang="lang"
    :code="code"
    :codeblock="codeblock"
  />
</template>
