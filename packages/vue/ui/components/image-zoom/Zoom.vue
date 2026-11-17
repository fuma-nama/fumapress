<script setup lang="ts">
// The uncontrolled `Zoom` of `react-medium-image-zoom`: its `Uncontrolled` state on its `Controlled` component.
import {
  computed,
  h,
  onBeforeUnmount,
  onMounted,
  onUpdated,
  shallowReactive,
  shallowRef,
  watch,
  type FunctionalComponent,
} from "vue";
import {
  adjustSvgIDs,
  getDialogContainer,
  getImgAlt,
  getImgSrc,
  getStyleGhost,
  getStyleModalImg,
  ICompress,
  IEnlarge,
  IMAGE_QUERY,
  testDiv,
  testImg,
  testImgLoaded,
  testSvg,
  toStyle,
  type ModalState,
  type StyleObject,
  type SupportedImage,
} from "./zoom";
import type { ZoomProps } from "./zoom";

const props = withDefaults(defineProps<ZoomProps>(), {
  a11yNameButtonUnzoom: "Minimize image",
  a11yNameButtonZoom: "Expand image",
  canSwipeToUnzoom: true,
  isDisabled: false,
  swipeToUnzoomThreshold: 10,
  wrapElement: "div",
  zoomMargin: 0,
});
const emit = defineEmits<{
  zoomChange: [value: boolean, data: { event: Event }];
}>();

// Uncontrolled
const isZoomed = shallowRef(false);
function onZoomChange(value: boolean, data: { event: Event }) {
  isZoomed.value = value;
  emit("zoomChange", value, data);
}

// Controlled
const defaultBodyAttrs = {
  overflow: "",
  width: "",
};

function handleDialogCancelStatic(e: Event) {
  e.preventDefault();
}

const state = shallowReactive({
  id: "",
  isZoomImgLoaded: false,
  loadedImgEl: undefined as HTMLImageElement | undefined,
  modalState: "UNLOADED" as ModalState,
  shouldRefresh: false,
  styleGhost: {} as StyleObject,
});
// a class component renders again on every `setState`, and reads the DOM while rendering
const renders = shallowRef(0);
function setState(partial: Partial<typeof state>) {
  Object.assign(state, partial);
  renders.value++;
}

const refContent = shallowRef<HTMLElement | null>(null);
const refDialog = shallowRef<HTMLDialogElement | null>(null);
const refModalContent = shallowRef<HTMLDivElement | null>(null);
const refModalImg = shallowRef<HTMLElement | null>(null);
const refWrap = shallowRef<HTMLElement | null>(null);
const container = shallowRef<HTMLElement | null>(null);
let imgEl: SupportedImage | null = null;
let isScaling = false;
let prevBodyAttrs = defaultBodyAttrs;
let touchYStart: number | undefined;
let touchYEnd: number | undefined;
let timeoutTransitionEnd: ReturnType<typeof setTimeout> | undefined;
let contentChangeObserver: MutationObserver | undefined;
let contentNotFoundChangeObserver: MutationObserver | undefined;
let imgElResizeObserver: ResizeObserver | undefined;

function handleModalStateChange(prevModalState: ModalState) {
  const { modalState } = state;
  if (prevModalState !== "LOADING" && modalState === "LOADING") {
    isScaling = false;
    loadZoomImg();
    window.addEventListener("resize", handleResize, { passive: true });
    window.addEventListener("touchstart", handleTouchStart, {
      passive: true,
    });
    window.addEventListener("touchmove", handleTouchMove, {
      passive: true,
    });
    window.addEventListener("touchend", handleTouchEnd, {
      passive: true,
    });
    window.addEventListener("touchcancel", handleTouchCancel, {
      passive: true,
    });
    document.addEventListener("keydown", handleKeyDown, true);
  } else if (prevModalState !== "LOADED" && modalState === "LOADED") {
    window.addEventListener("wheel", handleWheel, { passive: true });
  } else if (prevModalState !== "UNLOADING" && modalState === "UNLOADING") {
    ensureImgTransitionEnd();
    window.removeEventListener("wheel", handleWheel);
    window.removeEventListener("touchstart", handleTouchStart);
    window.removeEventListener("touchmove", handleTouchMove);
    window.removeEventListener("touchend", handleTouchEnd);
    window.removeEventListener("touchcancel", handleTouchCancel);
    document.removeEventListener("keydown", handleKeyDown, true);
  } else if (prevModalState !== "UNLOADED" && modalState === "UNLOADED") {
    bodyScrollEnable();
    window.removeEventListener("resize", handleResize);
    refDialog.value?.close();
  }
}

function setId() {
  const gen4 = () => Math.random().toString(16).slice(-4);
  setState({ id: gen4() + gen4() + gen4() });
}

function setAndTrackImg() {
  const contentEl = refContent.value;
  if (contentEl == null) return;
  imgEl = contentEl.querySelector<HTMLElement | SVGElement>(IMAGE_QUERY) as SupportedImage | null;
  if (imgEl !== null) {
    contentNotFoundChangeObserver?.disconnect();
    imgEl.addEventListener("load", handleImgLoad);
    imgEl.addEventListener("click", handleZoom);
    if (state.loadedImgEl == null) {
      handleImgLoad();
    }
    imgElResizeObserver = new ResizeObserver((entries) => {
      const [entry] = entries;
      if (entry?.target !== undefined) {
        imgEl = entry.target as SupportedImage;
        setState({ styleGhost: getStyleGhost(imgEl) });
      }
    });
    imgElResizeObserver.observe(imgEl);
    if (contentChangeObserver == null) {
      contentChangeObserver = new MutationObserver(() => {
        setState({ styleGhost: getStyleGhost(imgEl) });
      });
      contentChangeObserver.observe(contentEl, {
        attributes: true,
        childList: true,
        subtree: true,
      });
    }
  } else if (contentNotFoundChangeObserver == null) {
    contentNotFoundChangeObserver = new MutationObserver(setAndTrackImg);
    contentNotFoundChangeObserver.observe(contentEl, {
      childList: true,
      subtree: true,
    });
  }
}

function handleIfZoomChanged(prevIsZoomed: boolean) {
  if (!prevIsZoomed && isZoomed.value) {
    zoom();
  } else if (prevIsZoomed && !isZoomed.value) {
    unzoom();
  }
}

function handleImgLoad() {
  const imgSrc = getImgSrc(imgEl);
  if (imgSrc == null || imgSrc === "") return;
  const img = new Image();
  if (testImg(imgEl)) {
    const { sizes, srcset, crossOrigin } = imgEl;
    img.sizes = sizes;
    img.srcset = srcset;
    img.crossOrigin = crossOrigin;
  }
  img.src = imgSrc;
  const setLoaded = () => {
    setState({
      loadedImgEl: img,
      styleGhost: getStyleGhost(imgEl),
    });
  };
  img
    .decode()
    .then(setLoaded)
    .catch(() => {
      if (testImgLoaded(img)) {
        setLoaded();
        return;
      }
      img.onload = setLoaded;
    });
}

function handleZoom(e: Event) {
  if (props.isDisabled !== true && hasImage()) {
    onZoomChange(true, { event: e });
  }
}

function handleUnzoom(e: Event) {
  if (props.isDisabled !== true) {
    onZoomChange(false, { event: e });
  }
}

function handleBtnUnzoomClick(e: Event) {
  e.preventDefault();
  e.stopPropagation();
  handleUnzoom(e);
}

function handleDialogClick(e: Event) {
  if (e.target === refModalContent.value || e.target === refModalImg.value) {
    e.stopPropagation();
    handleUnzoom(e);
  }
}

function handleDialogClose(e: Event) {
  e.stopPropagation();
  handleUnzoom(e);
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    handleUnzoom(e);
  }
}

function handleWheel(e: WheelEvent) {
  if (e.ctrlKey) return;
  if (isScaling) return;
  const browserScale = window.visualViewport?.scale ?? 1;
  if (browserScale > 1) return;
  e.stopPropagation();
  queueMicrotask(() => {
    handleUnzoom(e);
  });
}

function handleTouchStart(e: TouchEvent) {
  if (e.touches.length > 1) {
    isScaling = true;
    return;
  }
  const { changedTouches } = e;
  const [changedTouch] = changedTouches;
  if (changedTouches.length === 1 && changedTouch !== undefined) {
    const { screenY } = changedTouch;
    touchYStart = screenY;
  }
}

function handleTouchMove(e: TouchEvent) {
  const browserScale = window.visualViewport?.scale ?? 1;
  const { changedTouches: changedTouchesMove } = e;
  const [changedTouchMove] = changedTouchesMove;
  if (
    props.canSwipeToUnzoom &&
    !isScaling &&
    browserScale <= 1 &&
    touchYStart != null &&
    changedTouchMove !== undefined
  ) {
    const { screenY } = changedTouchMove;
    touchYEnd = screenY;
    const max = Math.max(touchYStart, touchYEnd);
    const min = Math.min(touchYStart, touchYEnd);
    const delta = Math.abs(max - min);
    if (delta > props.swipeToUnzoomThreshold) {
      touchYStart = undefined;
      touchYEnd = undefined;
      handleUnzoom(e);
    }
  }
}

function handleTouchEnd() {
  touchYStart = undefined;
  touchYEnd = undefined;
}

function handleTouchCancel() {
  touchYStart = undefined;
  touchYEnd = undefined;
}

function handleResize() {
  setState({ shouldRefresh: true });
}

function hasImage() {
  return (
    imgEl !== null &&
    (state.loadedImgEl !== undefined || testSvg(imgEl)) &&
    window.getComputedStyle(imgEl).display !== "none"
  );
}

function zoom() {
  bodyScrollDisable();
  refDialog.value?.showModal();
  setState({ modalState: "LOADING" });
}

function unzoom() {
  setState({ modalState: "UNLOADING" });
}

function handleImgTransitionEnd() {
  clearTimeout(timeoutTransitionEnd);
  if (state.modalState === "LOADING") {
    setState({ modalState: "LOADED" });
  } else if (state.modalState === "UNLOADING") {
    setState({ shouldRefresh: false, modalState: "UNLOADED" });
  }
}

function ensureImgTransitionEnd() {
  if (refModalImg.value !== null) {
    const { transitionDuration: td } = window.getComputedStyle(refModalImg.value);
    const tdFloat = parseFloat(td);
    if (tdFloat !== 0 && !Number.isNaN(tdFloat)) {
      const tdMs = tdFloat * (td.endsWith("ms") ? 1 : 1000) + 50;
      timeoutTransitionEnd = setTimeout(handleImgTransitionEnd, tdMs);
    }
  }
}

function bodyScrollDisable() {
  const bodyStyle = document.body.style;
  prevBodyAttrs = {
    overflow: bodyStyle.overflow,
    width: bodyStyle.width,
  };
  const clientWidth = document.body.clientWidth;
  bodyStyle.overflow = "hidden";
  bodyStyle.width = `${clientWidth}px`;
}

function bodyScrollEnable() {
  const bodyStyle = document.body.style;
  const prev = prevBodyAttrs;
  bodyStyle.width = prev.width;
  bodyStyle.overflow = prev.overflow;
  prevBodyAttrs = defaultBodyAttrs;
}

function loadZoomImg() {
  const { zoomImg } = props;
  if (zoomImg == null) return;
  const { src: zoomImgSrc } = zoomImg;
  if (zoomImgSrc !== undefined && zoomImgSrc !== "") {
    const img = new Image();
    img.sizes = zoomImg.sizes ?? "";
    img.srcset = zoomImg.srcset ?? "";
    img.crossOrigin = zoomImg.crossorigin ?? null;
    img.src = zoomImgSrc;
    const setLoaded = () => {
      setState({ isZoomImgLoaded: true });
    };
    img
      .decode()
      .then(setLoaded)
      .catch(() => {
        if (testImgLoaded(img)) {
          setLoaded();
          return;
        }
        img.onload = setLoaded;
      });
  }
}

function UNSAFE_handleSvg() {
  const { styleModalImg } = view.value;
  if (testSvg(imgEl)) {
    const svgEl = imgEl.cloneNode(true) as SVGElement;
    adjustSvgIDs(svgEl);
    svgEl.style.width = `${styleModalImg.width ?? 0}px`;
    svgEl.style.height = `${styleModalImg.height ?? 0}px`;
    svgEl.addEventListener("click", handleUnzoom);
    refModalImg.value?.firstChild?.remove();
    refModalImg.value?.appendChild(svgEl);
  }
}

// what `render()` computes
const view = computed(() => {
  void renders.value;
  const { a11yNameButtonZoom, zoomImg, zoomMargin } = props;
  const { id, loadedImgEl, modalState, shouldRefresh } = state;
  const idModal = `rmiz-modal-${id}`;
  const idModalImg = `rmiz-modal-img-${id}`;
  const isDiv = testDiv(imgEl);
  const isImg = testImg(imgEl);
  const isSvg = testSvg(imgEl);
  const imgAlt = getImgAlt(imgEl);
  const imgSrc = getImgSrc(imgEl);
  const imgSizes = isImg ? (imgEl as HTMLImageElement).sizes : undefined;
  const imgSrcSet = isImg ? (imgEl as HTMLImageElement).srcset : undefined;
  const imgCrossOrigin = isImg ? (imgEl as HTMLImageElement).crossOrigin : undefined;
  const hasZoomImg = zoomImg?.src !== undefined && zoomImg.src !== "";
  const hasImageValue = hasImage();
  const labelBtnZoom =
    imgAlt !== undefined && imgAlt !== "" ? `${a11yNameButtonZoom}: ${imgAlt}` : a11yNameButtonZoom;
  const isModalActive = modalState === "LOADING" || modalState === "LOADED";
  const dataContentState = hasImageValue ? "found" : "not-found";
  const dataOverlayState =
    modalState === "UNLOADED" || modalState === "UNLOADING" ? "hidden" : "visible";
  const styleContent = {
    visibility: modalState === "UNLOADED" ? "visible" : "hidden",
  } as const;
  const styleModalImg: StyleObject =
    hasImageValue && imgEl !== null
      ? getStyleModalImg({
          hasZoomImg,
          imgSrc,
          isSvg,
          isZoomed: isModalActive,
          loadedImgEl,
          offset: zoomMargin,
          shouldRefresh,
          targetEl: imgEl,
        })
      : {};

  return {
    idModal,
    idModalImg,
    isDiv,
    isImg,
    isSvg,
    imgAlt,
    imgSrc,
    imgSizes,
    imgSrcSet,
    imgCrossOrigin,
    hasImage: hasImageValue,
    labelBtnZoom,
    dataContentState,
    dataOverlayState,
    styleContent,
    styleModalImg,
  };
});

const ModalImg: FunctionalComponent = () => {
  const v = view.value;
  if (v.isImg || v.isDiv) {
    return h("img", {
      alt: v.imgAlt,
      crossorigin: v.imgCrossOrigin,
      sizes: v.imgSizes,
      src: v.imgSrc,
      srcset: v.imgSrcSet,
      ...(state.isZoomImgLoaded && state.modalState === "LOADED" ? props.zoomImg : {}),
      "data-rmiz-modal-img": "",
      height: v.styleModalImg.height ?? undefined,
      id: v.idModalImg,
      onTransitionend: handleImgTransitionEnd,
      ref: refModalImg,
      style: toStyle(v.styleModalImg),
      width: v.styleModalImg.width ?? undefined,
    });
  }
  if (v.isSvg) {
    return h("div", {
      "data-rmiz-modal-img": true,
      onTransitionend: handleImgTransitionEnd,
      ref: refModalImg,
      style: toStyle(v.styleModalImg),
    });
  }
  return null;
};

const ModalBtnUnzoom: FunctionalComponent = () =>
  h(
    "button",
    {
      "aria-label": props.a11yNameButtonUnzoom,
      "data-rmiz-btn-unzoom": "",
      onClick: handleBtnUnzoomClick,
      type: "button",
    },
    h(props.IconUnzoom ?? ICompress),
  );

function zoomContentProps() {
  const v = view.value;
  return {
    buttonUnzoom: h(ModalBtnUnzoom),
    modalState: state.modalState,
    img: v.isImg || v.isDiv || v.isSvg ? h(ModalImg) : null,
    isZoomImgLoaded: state.isZoomImgLoaded,
    onUnzoom: handleUnzoom,
  };
}

// componentDidUpdate
watch(
  () => state.modalState,
  (_, prevModalState) => handleModalStateChange(prevModalState),
  { flush: "post" },
);
watch(isZoomed, (_, prevIsZoomed) => handleIfZoomChanged(prevIsZoomed), { flush: "post" });
onUpdated(UNSAFE_handleSvg);

onMounted(() => {
  container.value = getDialogContainer();
  setId();
  setAndTrackImg();
  handleImgLoad();
  UNSAFE_handleSvg();
});

onBeforeUnmount(() => {
  if (state.modalState !== "UNLOADED") {
    bodyScrollEnable();
  }
  contentChangeObserver?.disconnect();
  contentNotFoundChangeObserver?.disconnect();
  imgElResizeObserver?.disconnect();
  imgEl?.removeEventListener("load", handleImgLoad);
  imgEl?.removeEventListener("click", handleZoom);
  clearTimeout(timeoutTransitionEnd);
  window.removeEventListener("wheel", handleWheel);
  window.removeEventListener("touchstart", handleTouchStart);
  window.removeEventListener("touchmove", handleTouchMove);
  window.removeEventListener("touchend", handleTouchEnd);
  window.removeEventListener("touchcancel", handleTouchCancel);
  window.removeEventListener("resize", handleResize);
  document.removeEventListener("keydown", handleKeyDown, true);
});
</script>

<template>
  <component :is="wrapElement" ref="refWrap" data-rmiz="">
    <component
      :is="wrapElement"
      ref="refContent"
      :data-rmiz-content="view.dataContentState"
      :style="view.styleContent"
    >
      <slot />
    </component>
    <component
      :is="wrapElement"
      v-if="view.hasImage"
      data-rmiz-ghost=""
      :style="toStyle(state.styleGhost)"
    >
      <button
        :aria-label="view.labelBtnZoom"
        data-rmiz-btn-zoom=""
        type="button"
        @click="handleZoom"
      >
        <component :is="IconZoom ?? IEnlarge" />
      </button>
    </component>
    <Teleport v-if="view.hasImage && container" :to="container">
      <dialog
        :id="view.idModal"
        ref="refDialog"
        :aria-labelledby="view.idModalImg"
        aria-modal="true"
        v-bind="{ class: classDialog }"
        data-rmiz-modal=""
        role="dialog"
        @click="handleDialogClick"
        @close="handleDialogClose"
        @cancel="handleDialogCancelStatic"
      >
        <div :data-rmiz-modal-overlay="view.dataOverlayState" />
        <div ref="refModalContent" data-rmiz-modal-content="">
          <component :is="ZoomContent" v-if="ZoomContent" v-bind="zoomContentProps()" />
          <template v-else>
            <ModalImg />
            <ModalBtnUnzoom />
          </template>
        </div>
      </dialog>
    </Teleport>
  </component>
</template>
