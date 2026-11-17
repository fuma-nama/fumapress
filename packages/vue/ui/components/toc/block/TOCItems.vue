<script setup lang="ts">
import { computed, onMounted, useTemplateRef, watch } from "vue";
import { useTOC, type TOCItemInfo } from "../../../core/toc";
import { cn } from "../../../utils/cn";
import type { TOCItemsProps } from "./index";

const props = defineProps<TOCItemsProps>();
const tocInfo = useTOC();
const blockRef = useTemplateRef<HTMLDivElement>("block");
const className = computed(() => cn("relative flex flex-col", props.class));

onMounted(() => {
  watch(
    tocInfo,
    (tocInfo, _, onCleanup) => {
      const block = blockRef.value;
      if (!block) return;

      const container = block.parentElement!;
      // measured on resize only, so active changes never read layout
      const positions = new Map<string, [top: number, bottom: number]>();
      let height = 0;

      const update = (items: TOCItemInfo[]) => {
        let top = -1;
        let bottom = -1;
        for (const item of items) {
          if (!item.active) continue;
          const pos = positions.get(item.original.url);
          if (!pos) continue;
          if (top === -1) top = pos[0];
          bottom = pos[1];
        }

        if (top === -1) return;
        block.style.clipPath = `inset(${top}px 0 ${height - bottom}px round 8px)`;
        // place the block instantly at first, only animate the changes after
        if (!block.hasAttribute("data-ready"))
          requestAnimationFrame(() => block.setAttribute("data-ready", ""));
      };

      const observer = new ResizeObserver(() => {
        positions.clear();
        for (const anchor of container.getElementsByTagName("a")) {
          const href = anchor.getAttribute("href");
          if (href) positions.set(href, [anchor.offsetTop, anchor.offsetTop + anchor.offsetHeight]);
        }
        height = container.clientHeight;
        update(tocInfo.get());
      });

      observer.observe(container);
      tocInfo.listen(update);
      onCleanup(() => {
        observer.disconnect();
        tocInfo.unlisten(update);
      });
    },
    { immediate: true, flush: "post" },
  );
});
</script>

<template>
  <div :class="className">
    <div
      ref="block"
      class="absolute inset-0 bg-linear-to-r from-fd-primary/10 [clip-path:inset(0_0_100%)] data-ready:transition-[clip-path] duration-300 ease-out"
    />
    <slot />
  </div>
</template>
