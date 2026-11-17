<script setup lang="ts">
import { onBeforeUnmount, onMounted, watch } from "vue";
import { TabsTrigger as Trigger } from "reka-ui";
import { useTabContext } from "./context";

const props = defineProps<{ value: string }>();
const { triggers } = useTabContext();

onMounted(() => triggers.add(props.value));
watch(
  () => props.value,
  (value, previous) => {
    triggers.delete(previous);
    triggers.add(value);
  },
);
onBeforeUnmount(() => triggers.delete(props.value));
</script>

<template>
  <Trigger :value="value">
    <slot />
  </Trigger>
</template>
