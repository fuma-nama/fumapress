<script setup lang="ts">
import { onMounted, useTemplateRef, watch } from "vue";
import { useTOC, type TOCItemInfo, type TOCItemType } from "../../../core/toc";
import { getLineOffset } from "./utils";

interface ItemPosition {
  x: number;
  top: number;
  bottom: number;
}

const props = defineProps<{ items: TOCItemType[] }>();
const toc = useTOC();
const trackRef = useTemplateRef<HTMLDivElement>("track");

onMounted(() => {
  watch(
    [() => props.items, toc] as const,
    ([items, toc], _, onCleanup) => {
      const track = trackRef.value;
      if (!track) return;

      const container = track.parentElement!;
      const svg = track.querySelector("svg")!;
      const path = svg.querySelector("path")!;
      const steps = svg.getElementsByTagName("g");
      const positions = new Map<string, ItemPosition>();

      const update = (infos: TOCItemInfo[]) => {
        let top = -1;
        let bottom = -1;
        for (const info of infos) {
          const position = info.active ? positions.get(info.original.url) : undefined;
          if (!position) continue;
          if (top === -1) top = position.top;
          bottom = position.bottom;
        }
        if (top !== -1)
          svg.style.clipPath = `polygon(0 ${top}px, 100% ${top}px, 100% ${bottom}px, 0 ${bottom}px)`;
      };

      // called after layout and before paint, so the track never lags behind the items
      const observer = new ResizeObserver(() => {
        if (container.clientHeight === 0) return;
        const anchors = new Map<string | null, HTMLElement>();
        for (const anchor of container.getElementsByTagName("a"))
          anchors.set(anchor.getAttribute("href"), anchor);

        let d = "";
        let width = 0;
        let height = 0;
        let last: ItemPosition | undefined;
        positions.clear();

        for (const item of items) {
          const anchor = anchors.get(item.url);
          if (!anchor) continue;

          const styles = getComputedStyle(anchor);
          const x = getLineOffset(item.depth) + 0.5;
          const top = anchor.offsetTop + parseFloat(styles.paddingTop);
          const bottom = anchor.offsetTop + anchor.clientHeight - parseFloat(styles.paddingBottom);

          d += last ? ` L ${last.x} ${last.bottom} ${x} ${top}` : `M${x} ${top}`;
          d += ` L${x} ${bottom}`;
          last = { x, top, bottom };
          positions.set(item.url, last);
          width = Math.max(width, x + 8);
          height = Math.max(height, bottom);
        }

        // write after all reads, a write between them forces another layout
        let step = 0;
        for (const item of items) {
          if (item._step === undefined) continue;
          const position = positions.get(item.url);
          const g = steps[step++];
          if (position && g)
            g.setAttribute(
              "transform",
              `translate(${position.x}, ${(position.top + position.bottom) / 2})`,
            );
        }
        path.setAttribute("d", d);
        track.style.width = `${width}px`;
        track.style.height = `${height}px`;
        update(toc.get());
      });

      observer.observe(container);
      toc.listen(update);
      onCleanup(() => {
        observer.disconnect();
        toc.unlisten(update);
      });
    },
    { immediate: true, flush: "post" },
  );
});
</script>

<template>
  <div ref="track" class="absolute top-0 inset-s-0 origin-center rtl:-scale-x-100">
    <svg
      class="absolute size-full [clip-path:polygon(0_0,100%_0,100%_0,0_0)] transition-[clip-path]"
    >
      <path class="stroke-fd-primary" stroke-width="1" fill="none" />
      <template v-for="item in items" :key="item.url">
        <g v-if="item._step !== undefined">
          <circle r="8" class="fill-fd-primary" />
          <text
            text-anchor="middle"
            alignment-baseline="central"
            dominant-baseline="middle"
            class="fill-fd-primary-foreground font-medium text-xs leading-none font-mono rtl:-scale-x-100"
          >
            {{ item._step }}
          </text>
        </g>
      </template>
    </svg>
  </div>
</template>
