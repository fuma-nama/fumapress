<script setup lang="ts">
import { onMounted, shallowRef, watch, type VNodeChild } from "vue";
import type { Highlighter } from "@fumapress/vue/highlight";
import { toJsx, type Components } from "../../core/utils/hast-to-jsx";
import { loadLanguage } from "./context";

const props = defineProps<{
  highlighter: Highlighter;
  lang: string;
  code: string;
  components: Partial<Components>;
}>();
defineSlots<{
  /** rendered while the language loads */
  fallback?: () => VNodeChild;
}>();

// the server and the first render in the browser render the fallback while a language may load, then hydration matches
const ready = shallowRef(!props.highlighter.loadLanguage);
const failed = shallowRef<{ error: unknown }>();

onMounted(() => {
  watch(
    () => [props.highlighter, props.lang] as const,
    ([highlighter, lang], _, onCleanup) => {
      if (!highlighter.loadLanguage) {
        ready.value = true;
        return;
      }

      const result = loadLanguage(
        highlighter as Highlighter & Required<Pick<Highlighter, "loadLanguage">>,
        lang,
      );
      if (result === true) {
        ready.value = true;
        return;
      }

      let current = true;
      onCleanup(() => {
        current = false;
      });
      ready.value = false;
      result.then(
        () => {
          if (current) ready.value = true;
        },
        (error: unknown) => {
          if (current) failed.value = { error };
        },
      );
    },
    { immediate: true },
  );
});

function Node(): VNodeChild {
  // like `use()` of the source, a failed load throws
  if (failed.value) throw failed.value.error;
  return toJsx(props.highlighter.codeToHast(props.code, { lang: props.lang }), {
    components: props.components,
  });
}
</script>

<template>
  <Node v-if="ready || failed" />
  <slot v-else name="fallback" />
</template>
