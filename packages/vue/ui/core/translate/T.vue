<script setup lang="ts">
import { inject, useSlots } from "vue";
import { lookup, REGEX_VAR, TranslationsKey } from "./context";

/** a translated text, the slot named after a variable renders in its place */
const props = defineProps<{
  text: string;
  /**
   * add more context to `text`.
   * @example "The aria-label of close dialog button"
   */
  note?: string;
  variables?: Record<string, string>;
}>();
const slots = useSlots();
const translations = inject(TranslationsKey, undefined);

/** texts, and the names of variables that have a slot */
function parts(): (string | { slot: string })[] {
  const text = lookup(translations?.value, props.text, [props.note]);
  const out: (string | { slot: string })[] = [];
  let pending = "";
  let idx = 0;

  for (const match of text.matchAll(REGEX_VAR)) {
    const [s, name] = match;
    pending += text.slice(idx, match.index);
    idx = match.index + s.length;

    if (s[0] === "\\") pending += s.slice(1);
    else if (name && slots[name]) {
      if (pending) out.push(pending);
      out.push({ slot: name });
      pending = "";
    } else if (name && props.variables && name in props.variables) pending += props.variables[name];
    else pending += s;
  }

  pending += text.slice(idx);
  if (pending) out.push(pending);
  return out;
}
</script>

<template>
  <template v-for="(part, i) in parts()" :key="i">
    <template v-if="typeof part === 'string'">{{ part }}</template>
    <slot v-else :name="part.slot" />
  </template>
</template>
