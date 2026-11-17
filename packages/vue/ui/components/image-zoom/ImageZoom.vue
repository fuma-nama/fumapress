<script setup lang="ts">
import { computed, inject, shallowRef, useAttrs, useSlots, watchEffect } from "vue";
import { Image } from "../../core/framework";
import { getImageSrc, LightboxKey } from "./context";
import type { ImageZoomProps } from "./index";
import Zoom from "./Zoom.vue";

defineOptions({ inheritAttrs: false });

const props = defineProps<ImageZoomProps>();
const attrs = useAttrs();
const slots = useSlots();
const lightbox = inject(LightboxKey, null);
const zoomImg = computed(() => ({
  src: getImageSrc(props.src),
  sizes: undefined,
  ...props.zoomInProps,
}));
const element = shallowRef<HTMLElement | null>(null);

if (lightbox) {
  watchEffect(
    (onCleanup) => {
      if (!element.value) return;
      onCleanup(
        lightbox.register({
          element: element.value,
          image: { alt: props.alt, ...zoomImg.value },
          caption: slots.caption ?? props.caption ?? (attrs.title as string | undefined),
        }),
      );
    },
    { flush: "post" },
  );
}

function onClick(e: MouseEvent) {
  if (e.target !== e.currentTarget) lightbox!.open(e.currentTarget as HTMLElement);
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key !== "Enter" && e.key !== " ") return;
  e.preventDefault();
  lightbox!.open(e.currentTarget as HTMLElement);
}
</script>

<template>
  <span
    v-if="lightbox"
    ref="element"
    role="button"
    tabindex="0"
    aria-haspopup="dialog"
    class="block outline-none [&_img]:cursor-zoom-in [&:focus-visible_img]:ring-2 [&:focus-visible_img]:ring-fd-ring"
    @click="onClick"
    @keydown="onKeyDown"
  >
    <slot>
      <Image
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 70vw, 900px"
        :src="src"
        :alt="alt"
        :priority="priority"
        v-bind="$attrs"
      />
    </slot>
  </span>
  <Zoom v-else :zoomMargin="20" wrapElement="span" v-bind="rmiz" :zoomImg="zoomImg">
    <slot>
      <Image
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 70vw, 900px"
        :src="src"
        :alt="alt"
        :priority="priority"
        v-bind="$attrs"
      />
    </slot>
  </Zoom>
</template>
