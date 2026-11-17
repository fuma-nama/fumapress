<script setup lang="ts">
import {
  onBeforeUnmount,
  onMounted,
  useTemplateRef,
  watch,
  type ComponentPublicInstance,
} from "vue";
import { TabsContent as Content } from "@fumapress/vue/reka/tabs";
import { useTabContext } from "./context";

// `id` is the tab's URL hash, the panel keeps the primitive's id that triggers point `aria-controls` at
const props = defineProps<{ value: string; id?: string }>();
const { valueToIdMap, panels } = useTabContext();
const contentRef = useTemplateRef<ComponentPublicInstance>("content");
const getElement = () => {
  const element: unknown = contentRef.value?.$el;
  return element instanceof HTMLElement ? element : undefined;
};

watch(
  () => [props.value, props.id] as const,
  ([value, id]) => {
    if (id) valueToIdMap.set(value, id);
  },
  { immediate: true },
);

onMounted(() => panels.set(props.value, getElement));
watch(
  () => props.value,
  (value, previous) => {
    panels.delete(previous);
    panels.set(value, getElement);
  },
);
onBeforeUnmount(() => panels.delete(props.value));
</script>

<template>
  <Content ref="content" :value="value">
    <slot />
  </Content>
</template>
