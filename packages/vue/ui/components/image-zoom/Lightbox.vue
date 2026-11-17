<script setup lang="ts">
import {
  nextTick,
  provide,
  shallowRef,
  watch,
  type CSSProperties,
  type FunctionalComponent,
} from "vue";
import { ChevronLeft, ChevronRight, X } from "lucide-vue-next";
import { useTranslations } from "../../core/translate";
import { cn } from "../../utils/cn";
import { buttonVariants } from "../ui/button";
import { LightboxKey, type Caption, type Item, type Slide } from "./context";

const t = useTranslations({ note: "image zoom" });
const slides = shallowRef<Slide[] | null>(null);
const scrollerRef = shallowRef<HTMLDivElement | null>(null);
const dialogRef = shallowRef<HTMLDialogElement | null>(null);
const items = new Set<Item>();

provide(LightboxKey, {
  register(item: Item) {
    items.add(item);
    return () => void items.delete(item);
  },
  open(element: HTMLElement) {
    const list: Slide[] = [];
    for (const item of items) {
      if (!item.element.checkVisibility()) continue;
      const img = item.element.querySelector("img");
      list.push({ ...item, style: img ? getSlideStyle(img) : undefined });
    }
    list.sort((a, b) =>
      a.element.compareDocumentPosition(b.element) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
    );
    const index = list.findIndex((slide) => slide.element === element);

    transition(getImage(element), async () => {
      slides.value = list;
      await nextTick();
      const slide = scrollerRef.value!.children[index]!;
      slide.scrollIntoView({ block: "nearest", inline: "start", behavior: "instant" });
      return slide.querySelector("img")!;
    });
  },
});

function close() {
  const scroller = scrollerRef.value;
  const current = slides.value;
  if (!scroller || !current) return;
  const index = getIndex(scroller);
  const { element } = current[index]!;

  transition(scroller.children[index]!.querySelector("img")!, async () => {
    slides.value = null;
    await nextTick();
    element.focus({ preventScroll: true });
    const image = getImage(element);
    image.scrollIntoView({ block: "nearest", behavior: "instant" });
    return image;
  });
}

function navigate(step: number) {
  const scroller = scrollerRef.value!;
  scroller.children[getIndex(scroller) + step]?.scrollIntoView({
    block: "nearest",
    inline: "start",
    behavior: "smooth",
  });
}

// initDialog
watch(
  dialogRef,
  (element, _, onCleanup) => {
    if (!element) return;
    if (!element.open) element.showModal();
    element.focus();
    const { style } = document.documentElement;
    const overflow = style.overflow;
    style.overflow = "hidden";
    onCleanup(() => {
      style.overflow = overflow;
    });
  },
  { flush: "post" },
);

function onCancel(e: Event) {
  e.preventDefault();
  close();
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
  e.preventDefault();
  const rtl = getComputedStyle(e.currentTarget as Element).direction === "rtl";
  navigate((e.key === "ArrowRight") !== rtl ? 1 : -1);
}

function onScrollerClick(e: MouseEvent) {
  if (!(e.target as Element).closest("figcaption")) close();
}

function imageAttrs(slide: Slide) {
  const { class: className, ...image } = slide.image;
  return {
    loading: "lazy" as const,
    ...image,
    style: slide.style,
    class: cn("max-h-full cursor-zoom-out bg-cover", className),
  };
}

const CaptionContent: FunctionalComponent<{ value: Caption }> = ({ value }) =>
  typeof value === "function" ? value() : value;

const closeClass = cn(
  buttonVariants({
    variant: "ghost",
    size: "icon-sm",
    className: "absolute top-3.25 inset-e-2.5",
  }),
);
const previousClass = cn(
  buttonVariants({
    variant: "ghost",
    size: "icon",
    className: "absolute top-1/2 inset-s-2.5 -translate-y-1/2 max-md:hidden",
  }),
);
const nextClass = cn(
  buttonVariants({
    variant: "ghost",
    size: "icon",
    className: "absolute top-1/2 inset-e-2.5 -translate-y-1/2 max-md:hidden",
  }),
);

function getIndex(scroller: HTMLElement) {
  return Math.round(Math.abs(scroller.scrollLeft) / scroller.clientWidth);
}

function getImage(element: HTMLElement): HTMLElement {
  return element.querySelector("img") ?? element;
}

// sized from the page image, so the slide has its final box before loading
function getSlideStyle(img: HTMLImageElement): CSSProperties {
  const ratio = (img.naturalWidth || img.width) / (img.naturalHeight || img.height);

  return {
    width: ratio ? `min(100cqw, ${ratio} * 100cqh)` : undefined,
    aspectRatio: ratio ? `auto ${ratio}` : undefined,
    backgroundImage: img.currentSrc ? `url(${JSON.stringify(img.currentSrc)})` : undefined,
  };
}

/**
 * morph `from` into the element returned by `update`
 */
function transition(from: HTMLElement, update: () => Promise<HTMLElement>) {
  if (
    !("startViewTransition" in document) ||
    matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    void update();
    return;
  }

  let to: HTMLElement | undefined;
  from.style.viewTransitionName = "fd-lightbox";
  document
    .startViewTransition(async () => {
      from.style.viewTransitionName = "";
      to = await update();
      to.style.viewTransitionName = "fd-lightbox";
    })
    .finished.finally(() => {
      if (to) to.style.viewTransitionName = "";
    });
}
</script>

<template>
  <slot />
  <Teleport v-if="slides" to="body">
    <dialog
      ref="dialogRef"
      tabindex="-1"
      :aria-label="t('Image Viewer', { note: 'aria-label' })"
      class="m-0 size-full max-h-none max-w-none overflow-hidden border-none bg-fd-background p-0 text-fd-foreground outline-none"
      @cancel="onCancel"
      @close="slides = null"
      @keydown="onKeyDown"
    >
      <button
        type="button"
        :aria-label="t('Close', { note: 'aria-label' })"
        :class="closeClass"
        @click="close"
      >
        <X />
      </button>
      <div
        ref="scrollerRef"
        class="flex size-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none]"
        @click="onScrollerClick"
      >
        <figure
          v-for="(slide, i) in slides"
          :key="i"
          class="flex w-full shrink-0 snap-start snap-always flex-col items-center pb-6"
        >
          <p
            class="flex h-14 w-full items-center px-4 text-sm text-fd-muted-foreground tabular-nums"
          >
            <template v-if="slides.length > 1">{{ `${i + 1} / ${slides.length}` }}</template>
          </p>
          <div
            class="flex min-h-0 w-full flex-1 items-center justify-center px-4 [container-type:size] md:px-16"
          >
            <img v-bind="imageAttrs(slide)" />
          </div>
          <figcaption
            v-if="slide.caption"
            class="prose prose-sm mt-4 px-4 text-center text-fd-muted-foreground md:px-16"
          >
            <CaptionContent :value="slide.caption" />
          </figcaption>
        </figure>
      </div>
      <template v-if="slides.length > 1">
        <button
          type="button"
          :aria-label="t('Previous Image', { note: 'aria-label' })"
          :class="previousClass"
          @click="navigate(-1)"
        >
          <ChevronLeft class="rtl:-scale-x-100" />
        </button>
        <button
          type="button"
          :aria-label="t('Next Image', { note: 'aria-label' })"
          :class="nextClass"
          @click="navigate(1)"
        >
          <ChevronRight class="rtl:-scale-x-100" />
        </button>
      </template>
    </dialog>
  </Teleport>
</template>
