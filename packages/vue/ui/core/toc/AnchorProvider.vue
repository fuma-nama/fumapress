<script setup lang="ts">
import { computed, onMounted, provide, watch } from "vue";
import type { AnchorProviderProps } from "./index";
import { Observer, ObserverKey } from "./observer";

const props = withDefaults(defineProps<AnchorProviderProps>(), { single: false });
const observer = computed(() => new Observer(props.toc, props.single));

onMounted(() => {
  watch(
    observer,
    (observer, _, onCleanup) => {
      observer.watch();
      onCleanup(() => observer.unwatch());
    },
    { immediate: true },
  );
});

provide(ObserverKey, observer);
</script>

<template>
  <slot />
</template>
