<script setup lang="ts">
import { provide, toRef } from "vue";
import type { Highlighter } from "@fumapress/vue/highlight";
import type { Components } from "../../core/utils/hast-to-jsx";
import { PropsKey } from "./context";
import Highlighted from "./Highlighted.vue";
import Placeholder from "./Placeholder.vue";
import type { DynamicCodeblockProps } from "./index";

const props = withDefaults(
  defineProps<
    Omit<DynamicCodeblockProps, "highlighter" | "options"> & {
      highlighter: Highlighter;
      components: Partial<Components>;
    }
  >(),
  { wrapInSuspense: true },
);
provide(PropsKey, toRef(props, "codeblock"));
// only loading renders the fallback
</script>

<template>
  <Highlighted :highlighter="highlighter" :lang="lang" :code="code" :components="components">
    <template v-if="wrapInSuspense && highlighter.loadLanguage" #fallback>
      <Placeholder :code="code" :components="components" />
    </template>
  </Highlighted>
</template>
