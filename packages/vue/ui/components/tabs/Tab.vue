<script setup lang="ts">
import { computed } from "vue";
import { escapeValue, useCollectionIndex, useTabContext } from "./context";
import type { TabProps } from "./index";
import TabsContent from "./TabsContent.vue";

const props = defineProps<TabProps>();
const { items } = useTabContext();
// `value` is not supposed to change
const index = props.value === undefined ? useCollectionIndex() : undefined;
const resolved = computed(() => {
  const value = props.value ?? (index === undefined ? undefined : items.value?.at(index));
  if (!value)
    throw new Error(
      "Failed to resolve tab `value`, please pass a `value` prop to the Tab component.",
    );

  return value;
});
</script>

<template>
  <TabsContent :value="escapeValue(resolved)">
    <slot />
  </TabsContent>
</template>
