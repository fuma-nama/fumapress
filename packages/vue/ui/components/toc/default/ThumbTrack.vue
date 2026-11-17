<script setup lang="ts">
import { onMounted, useTemplateRef, watch } from "vue";
import { useTOC, type TOCItemInfo, type TOCItemType } from "../../../core/toc";
import { getLineOffset } from "./utils";

interface ItemPosition {
  x: number;
  top: number;
  bottom: number;
  /** length of the track until `top` */
  offset: number;
}

const props = defineProps<{ items: TOCItemType[]; thumbBox: boolean }>();
const toc = useTOC();
const trackRef = useTemplateRef<HTMLDivElement>("track");

onMounted(() => {
  watch(
    [() => props.items, () => props.thumbBox, toc] as const,
    ([items, thumbBox, toc], _, onCleanup) => {
      const track = trackRef.value;
      if (!track) return;

      const container = track.parentElement!;
      const svg = track.querySelector("svg")!;
      const path = svg.querySelector("path")!;
      const steps = svg.getElementsByTagName("g");
      const thumb = thumbBox ? track.querySelector("div") : null;
      const segment = document.createElementNS("http://www.w3.org/2000/svg", "path");
      const positions = new Map<string, ItemPosition>();
      let previous: { start: number; end: number; isUp: boolean } | undefined;

      const update = (infos: TOCItemInfo[]) => {
        let start = -1;
        let end = -1;
        for (const [i, info] of infos.entries()) {
          if (!info.active || !positions.has(info.original.url)) continue;
          if (start === -1) start = i;
          end = i;
        }
        if (start === -1) return;

        const first = positions.get(infos[start]!.original.url)!;
        const last = positions.get(infos[end]!.original.url)!;
        svg.style.clipPath = `polygon(0 ${first.top}px, 100% ${first.top}px, 100% ${last.bottom}px, 0 ${last.bottom}px)`;
        if (!thumb) return;

        const isUp =
          previous !== undefined &&
          (previous.start > start ||
            previous.end > end ||
            (previous.start === start && previous.end === end && previous.isUp));
        previous = { start, end, isUp };
        thumb.style.offsetDistance = `${isUp ? first.offset : last.offset + last.bottom - last.top}px`;
        thumb.style.opacity = infos[isUp ? start : end]!.original._step === undefined ? "1" : "0";
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
        let length = 0;
        let last: ItemPosition | undefined;
        positions.clear();

        for (const item of items) {
          const anchor = anchors.get(item.url);
          if (!anchor) continue;

          const styles = getComputedStyle(anchor);
          const x = getLineOffset(item.depth) + 0.5;
          const top = anchor.offsetTop + parseFloat(styles.paddingTop);
          const bottom = anchor.offsetTop + anchor.clientHeight - parseFloat(styles.paddingBottom);

          if (last) {
            const curve = `C ${last.x} ${top - 4} ${x} ${last.bottom + 4} ${x} ${top}`;
            d += ` ${curve} L${x} ${bottom}`;
            if (thumb) {
              segment.setAttribute("d", `M${last.x} ${last.bottom} ${curve}`);
              length += segment.getTotalLength();
            }
          } else {
            d += `M${x} ${top} L${x} ${bottom}`;
          }

          last = { x, top, bottom, offset: length };
          positions.set(item.url, last);
          length += bottom - top;
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
        if (thumb) thumb.style.offsetPath = `path("${d}")`;
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
    <div
      v-if="thumbBox"
      class="absolute left-0 size-1 bg-fd-primary rounded-full opacity-0 transition-[opacity,offset-distance]"
    />
  </div>
</template>
