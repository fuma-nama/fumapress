<script setup lang="ts">
import { computed, inject, onMounted, useTemplateRef, watch } from "vue";
import scrollIntoView from "scroll-into-view-if-needed";
import type { TOCItemProps } from "./index";
import { getItemId, ScrollKey, useObserver, useObserverValue } from "./observer";

const props = withDefaults(defineProps<TOCItemProps>(), { autoScroll: true });
const emit = defineEmits<{ activeChange: [v: boolean]; click: [e: MouseEvent] }>();

const id = computed(() => (props.href ? getItemId(props.href) : null));
const scroll = inject(ScrollKey, undefined);
const anchorRef = useTemplateRef("anchor");
let isMounted = false;
const observer = useObserver();
const active = useObserverValue(
  (observer) => id.value !== null && observer.activeAnchors.includes(id.value),
);

watch(active, (active) => emit("activeChange", active));

onMounted(() => {
  watch(
    [() => props.autoScroll, id, observer, () => scroll?.value],
    ([autoScroll, id, observer, container], _, onCleanup) => {
      if (id === null) return;

      const callback = () => {
        const anchor = anchorRef.value;

        if (autoScroll && observer.activeAnchor === id && anchor && container) {
          scrollIntoView(anchor, {
            behavior: isMounted ? "smooth" : "instant",
            block: "center",
            inline: "center",
            scrollMode: "always",
            boundary: container,
          });
        }
      };

      callback();
      // a scroll container is passed down once its element is mounted: the first run with it is the mount
      if (!scroll || container) isMounted = true;
      onCleanup(observer.subscribe(callback));
    },
    { immediate: true },
  );
});

function onClick(e: MouseEvent) {
  emit("click", e);
  if (id.value !== null && !e.defaultPrevented) observer.value.select(id.value);
}
</script>

<template>
  <a ref="anchor" :href="href" :data-active="String(active)" @click="onClick"><slot /></a>
</template>
