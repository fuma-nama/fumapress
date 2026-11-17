// A port of the uncontrolled `Zoom` of `react-medium-image-zoom` (5.4.9) and its utilities.
import { h, type Component, type CSSProperties, type ImgHTMLAttributes, type VNode } from "vue";

export type ModalState = "LOADED" | "LOADING" | "UNLOADED" | "UNLOADING";

export interface ZoomContentProps {
  buttonUnzoom: VNode;
  img: VNode | null;
  isZoomImgLoaded: boolean;
  modalState: ModalState;
  onUnzoom: (e: Event) => void;
}

/** `children` is the default slot, `onZoomChange` is the emit `zoomChange` */
export interface ZoomProps {
  a11yNameButtonUnzoom?: string;
  a11yNameButtonZoom?: string;
  canSwipeToUnzoom?: boolean;
  classDialog?: string;
  IconUnzoom?: Component;
  IconZoom?: Component;
  isDisabled?: boolean;
  swipeToUnzoomThreshold?: number;
  wrapElement?: "div" | "span";
  ZoomContent?: Component<ZoomContentProps>;
  zoomImg?: ImgHTMLAttributes;
  zoomMargin?: number;
}

export interface UncontrolledProps extends ZoomProps {
  onZoomChange?: (value: boolean, data: { event: Event }) => void;
}

export type SupportedImage = HTMLImageElement | HTMLDivElement | HTMLSpanElement | SVGElement;

export interface StyleObject {
  height?: number;
  left?: number;
  top?: number;
  transform?: string;
  transitionDuration?: string;
  width?: number;
}

interface ModalImgPosition {
  top: number;
  left: number;
  width: number;
  height: number;
  initialTransform: string;
}

export const IMAGE_QUERY = ["img", "svg", '[role="img"]', "[data-zoom]"]
  .map((x) => `${x}:not([aria-hidden="true"])`)
  .join(",");

export function getDialogContainer(): HTMLElement {
  const existing = document.querySelector<HTMLElement>("[data-rmiz-portal]");
  if (existing != null) {
    return existing;
  }
  const el = document.createElement("div");
  el.setAttribute("data-rmiz-portal", "");
  document.body.appendChild(el);
  return el;
}

/** React adds `px` to numbers of a style object, Vue doesn't */
export function toStyle(style: StyleObject): CSSProperties {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(style)) {
    if (value === undefined) continue;
    out[key] = typeof value === "number" ? `${value}px` : value;
  }
  return out;
}

export const ICompress: Component = () =>
  h(
    "svg",
    {
      "aria-hidden": "true",
      "data-rmiz-btn-unzoom-icon": true,
      fill: "currentColor",
      focusable: "false",
      viewBox: "0 0 16 16",
      xmlns: "http://www.w3.org/2000/svg",
    },
    h("path", {
      d: "M 14.144531 1.148438 L 9 6.292969 L 9 3 L 8 3 L 8 8 L 13 8 L 13 7 L 9.707031 7 L 14.855469 1.851563 Z M 8 8 L 3 8 L 3 9 L 6.292969 9 L 1.148438 14.144531 L 1.851563 14.855469 L 7 9.707031 L 7 13 L 8 13 Z",
    }),
  );

export const IEnlarge: Component = () =>
  h(
    "svg",
    {
      "aria-hidden": "true",
      "data-rmiz-btn-zoom-icon": true,
      fill: "currentColor",
      focusable: "false",
      viewBox: "0 0 16 16",
      xmlns: "http://www.w3.org/2000/svg",
    },
    h("path", {
      d: "M 9 1 L 9 2 L 12.292969 2 L 2 12.292969 L 2 9 L 1 9 L 1 14 L 6 14 L 6 13 L 2.707031 13 L 13 2.707031 L 13 6 L 14 6 L 14 1 Z",
    }),
  );

export function adjustSvgIDs(svgEl: SVGElement) {
  const newIdSuffix = "-zoom";
  const attrs = ["clip-path", "fill", "mask", "marker-start", "marker-mid", "marker-end"];
  const idMap = new Map<string, string>();

  if (svgEl.hasAttribute("id")) {
    const { id: oldId } = svgEl;
    const newId = oldId + newIdSuffix;
    idMap.set(oldId, newId);
    svgEl.id = newId;
  }

  svgEl.querySelectorAll("[id]").forEach((el) => {
    const { id: oldId } = el;
    const newId = oldId + newIdSuffix;
    idMap.set(oldId, newId);
    el.id = newId;
  });

  const urlAttrSelector = attrs.map((attr) => `[${attr}]`).join(", ");
  svgEl.querySelectorAll(urlAttrSelector).forEach((el) => {
    for (const attr of attrs) {
      const val = el.getAttribute(attr);
      if (val?.startsWith("url(#") === true) {
        const oldId = val.slice(5, -1);
        const newId = idMap.get(oldId);
        if (newId !== undefined) {
          el.setAttribute(attr, `url(#${newId})`);
        }
      }
    }
  });

  svgEl.querySelectorAll("style").forEach((styleEl) => {
    const { textContent } = styleEl;
    if (textContent !== "") {
      let updated = textContent;
      idMap.forEach((newId, oldId) => {
        updated = updated.replaceAll(`#${oldId}`, `#${newId}`);
      });
      if (updated !== textContent) {
        styleEl.textContent = updated;
      }
    }
  });
}

function isElement(el: unknown): el is Element {
  if (typeof Element === "undefined") {
    return false;
  }
  return el instanceof Element;
}

const testElType = (type: string, el: unknown) =>
  isElement(el) && el.tagName.toUpperCase() === type;

export const testDiv = (el: unknown): el is HTMLDivElement | HTMLSpanElement =>
  testElType("DIV", el) || testElType("SPAN", el);
export const testImg = (el: unknown): el is HTMLImageElement => testElType("IMG", el);
export const testImgLoaded = (el: HTMLImageElement) => el.complete && el.naturalHeight !== 0;
export const testSvg = (el: unknown): el is SVGElement => testElType("SVG", el);

export const getImgAlt = (imgEl: SupportedImage | null): string | undefined => {
  if (imgEl !== null) {
    if (testImg(imgEl)) {
      return imgEl.alt;
    } else {
      return imgEl.getAttribute("aria-label") ?? undefined;
    }
  }
};

const URL_REGEX = /url(?:\(['"]?)(?<url>.*?)(?:['"]?\))/;

export const getImgSrc = (imgEl: SupportedImage | null): string | undefined => {
  if (imgEl !== null) {
    if (testImg(imgEl)) {
      return imgEl.currentSrc === "" ? undefined : imgEl.currentSrc;
    } else if (testDiv(imgEl)) {
      const { backgroundImage: bgImg } = window.getComputedStyle(imgEl);
      if (bgImg !== "") {
        return URL_REGEX.exec(bgImg)?.[1];
      }
    }
  }
};

export const getStyleGhost = (imgEl: SupportedImage | null): StyleObject => {
  if (imgEl == null) {
    return {};
  }
  if (testSvg(imgEl)) {
    const { parentElement: parentEl } = imgEl;
    const rect = imgEl.getBoundingClientRect();
    if (parentEl == null) {
      return {
        height: rect.height,
        left: rect.left,
        width: rect.width,
        top: rect.top,
      };
    } else {
      const parentRect = parentEl.getBoundingClientRect();
      return {
        height: rect.height,
        left: parentRect.left - rect.left,
        top: parentRect.top - rect.top,
        width: rect.width,
      };
    }
  } else {
    const el = imgEl as HTMLElement;
    return {
      height: el.offsetHeight,
      left: el.offsetLeft,
      width: el.offsetWidth,
      top: el.offsetTop,
    };
  }
};

const parsePosition = (position: string, relativeNum: number) => {
  const positionNum = parseFloat(position);
  return position.endsWith("%") ? (relativeNum * positionNum) / 100 : positionNum;
};

const getTargetDimension = ({ fallback, natural }: { fallback: number; natural?: number }) =>
  natural !== undefined && natural !== 0 ? natural : fallback;

const SRC_SVG_REGEX = /\.svg$/i;

const testHasScalableSrc = ({
  hasZoomImg,
  imgSrc,
  isSvg,
}: {
  hasZoomImg: boolean;
  imgSrc?: string;
  isSvg: boolean;
}) =>
  isSvg ||
  imgSrc?.slice(0, 18) === "data:image/svg+xml" ||
  hasZoomImg ||
  (imgSrc !== undefined && SRC_SVG_REGEX.test(imgSrc));

const getScaleToWindow = ({
  height,
  offset,
  width,
}: {
  height: number;
  offset: number;
  width: number;
}) =>
  Math.min((window.innerWidth - offset * 2) / width, (window.innerHeight - offset * 2) / height);

interface ScaleOptions {
  containerHeight: number;
  containerWidth: number;
  hasScalableSrc: boolean;
  offset: number;
  targetHeight: number;
  targetWidth: number;
}

const getScaleToWindowMax = ({
  containerHeight,
  containerWidth,
  offset,
  targetHeight,
  targetWidth,
}: Omit<ScaleOptions, "hasScalableSrc">) => {
  const scale = getScaleToWindow({
    height: targetHeight,
    offset,
    width: targetWidth,
  });
  const ratio =
    targetWidth > targetHeight ? targetWidth / containerWidth : targetHeight / containerHeight;
  return scale > 1 ? ratio : scale * ratio;
};

const getScale = ({
  containerHeight,
  containerWidth,
  hasScalableSrc,
  offset,
  targetHeight,
  targetWidth,
}: ScaleOptions) => {
  if (containerHeight === 0 || containerWidth === 0) {
    return 1;
  }
  return !hasScalableSrc && targetHeight !== 0 && targetWidth !== 0
    ? getScaleToWindowMax({
        containerHeight,
        containerWidth,
        offset,
        targetHeight,
        targetWidth,
      })
    : getScaleToWindow({
        height: containerHeight,
        offset,
        width: containerWidth,
      });
};

interface ContainerOptions {
  containerHeight: number;
  containerLeft: number;
  containerTop: number;
  containerWidth: number;
  hasScalableSrc: boolean;
  offset: number;
  targetHeight: number;
  targetWidth: number;
}

const computePositionedStyle = ({
  containerHeight,
  containerLeft,
  containerTop,
  containerWidth,
  hasScalableSrc,
  offset,
  position,
  targetHeight,
  targetWidth,
  visibleHeight,
  visibleWidth,
}: ContainerOptions & {
  position: string;
  visibleHeight: number;
  visibleWidth: number;
}): ModalImgPosition => {
  const [posLeft = "50%", posTop = "50%"] = position.split(" ");
  const posX = parsePosition(posLeft, containerWidth - visibleWidth);
  const posY = parsePosition(posTop, containerHeight - visibleHeight);
  const scale = getScale({
    containerHeight: visibleHeight,
    containerWidth: visibleWidth,
    hasScalableSrc,
    offset,
    targetHeight,
    targetWidth,
  });
  return {
    top: containerTop + posY,
    left: containerLeft + posX,
    width: visibleWidth * scale,
    height: visibleHeight * scale,
    initialTransform: `translate(0,0) scale(${1 / scale})`,
  };
};

const getImgRegularStyle = ({
  containerHeight,
  containerLeft,
  containerTop,
  containerWidth,
  hasScalableSrc,
  offset,
  targetHeight,
  targetWidth,
}: ContainerOptions): ModalImgPosition => {
  const scale = getScale({
    containerHeight,
    containerWidth,
    hasScalableSrc,
    offset,
    targetHeight,
    targetWidth,
  });
  return {
    top: containerTop,
    left: containerLeft,
    width: containerWidth * scale,
    height: containerHeight * scale,
    initialTransform: `translate(0,0) scale(${1 / scale})`,
  };
};

const getImgObjectFitStyle = ({
  containerHeight,
  containerLeft,
  containerTop,
  containerWidth,
  hasScalableSrc,
  objectFit: objectFitParam,
  objectPosition,
  offset,
  targetHeight,
  targetWidth,
}: ContainerOptions & { objectFit: string; objectPosition: string }): ModalImgPosition => {
  let resolvedObjectFit = objectFitParam;
  if (resolvedObjectFit === "scale-down") {
    if (targetWidth <= containerWidth && targetHeight <= containerHeight) {
      resolvedObjectFit = "none";
    } else {
      resolvedObjectFit = "contain";
    }
  }
  const base = {
    containerHeight,
    containerLeft,
    containerTop,
    containerWidth,
    hasScalableSrc,
    offset,
    position: objectPosition,
    targetHeight,
    targetWidth,
  };
  if (resolvedObjectFit === "cover" || resolvedObjectFit === "contain") {
    const widthRatio = containerWidth / targetWidth;
    const heightRatio = containerHeight / targetHeight;
    const ratio =
      resolvedObjectFit === "cover"
        ? Math.max(widthRatio, heightRatio)
        : Math.min(widthRatio, heightRatio);
    return computePositionedStyle({
      ...base,
      visibleWidth: targetWidth * ratio,
      visibleHeight: targetHeight * ratio,
    });
  } else if (resolvedObjectFit === "none") {
    return computePositionedStyle({
      ...base,
      visibleWidth: targetWidth,
      visibleHeight: targetHeight,
    });
  } else {
    const widthRatio = containerWidth / targetWidth;
    const heightRatio = containerHeight / targetHeight;
    const ratio = Math.max(widthRatio, heightRatio);
    const scale = getScale({
      containerHeight: targetHeight * ratio,
      containerWidth: targetWidth * ratio,
      hasScalableSrc,
      offset,
      targetHeight,
      targetWidth,
    });
    return {
      top: containerTop,
      left: containerLeft,
      width: containerWidth * scale,
      height: containerHeight * scale,
      initialTransform: `translate(0,0) scale(${1 / scale})`,
    };
  }
};

const getDivImgStyle = ({
  backgroundPosition,
  backgroundSize,
  containerHeight,
  containerLeft,
  containerTop,
  containerWidth,
  hasScalableSrc,
  offset,
  targetHeight,
  targetWidth,
}: ContainerOptions & {
  backgroundPosition: string;
  backgroundSize: string;
}): ModalImgPosition => {
  const base = {
    containerHeight,
    containerLeft,
    containerTop,
    containerWidth,
    hasScalableSrc,
    offset,
    position: backgroundPosition,
    targetHeight,
    targetWidth,
  };
  if (backgroundSize === "cover" || backgroundSize === "contain") {
    const widthRatio = containerWidth / targetWidth;
    const heightRatio = containerHeight / targetHeight;
    const ratio =
      backgroundSize === "cover"
        ? Math.max(widthRatio, heightRatio)
        : Math.min(widthRatio, heightRatio);
    return computePositionedStyle({
      ...base,
      visibleWidth: targetWidth * ratio,
      visibleHeight: targetHeight * ratio,
    });
  } else if (backgroundSize === "auto") {
    return computePositionedStyle({
      ...base,
      visibleWidth: targetWidth,
      visibleHeight: targetHeight,
    });
  } else {
    const [sizeW = "50%", sizeH = "50%"] = backgroundSize.split(" ");
    const sizeWidth = parsePosition(sizeW, containerWidth);
    const sizeHeight = parsePosition(sizeH, containerHeight);
    const widthRatio = sizeWidth / targetWidth;
    const heightRatio = sizeHeight / targetHeight;
    const ratio = Math.min(widthRatio, heightRatio);
    return computePositionedStyle({
      ...base,
      visibleWidth: targetWidth * ratio,
      visibleHeight: targetHeight * ratio,
    });
  }
};

const getModalImgTransform = ({
  height,
  initialTransform,
  isZoomed,
  left,
  top,
  userTransform,
  width,
}: ModalImgPosition & { isZoomed: boolean; userTransform: string }) => {
  let centeredUserTransform = "";
  if (userTransform !== "none" && userTransform !== "") {
    const halfWidth = width / 2;
    const halfHeight = height / 2;
    centeredUserTransform = `translate(${halfWidth}px,${halfHeight}px) ${userTransform} translate(${-halfWidth}px,${-halfHeight}px)`;
  }
  if (!isZoomed) {
    if (centeredUserTransform === "") return initialTransform;
    return `${initialTransform} ${centeredUserTransform}`;
  }
  const viewportX = window.innerWidth / 2;
  const viewportY = window.innerHeight / 2;
  const childCenterX = left + width / 2;
  const childCenterY = top + height / 2;
  const translateX = viewportX - childCenterX;
  const translateY = viewportY - childCenterY;
  const base = `translate(${translateX}px,${translateY}px) scale(1)`;
  if (centeredUserTransform === "") return base;
  return `${base} ${centeredUserTransform}`;
};

export const getStyleModalImg = ({
  hasZoomImg,
  imgSrc,
  isSvg,
  isZoomed,
  loadedImgEl,
  offset,
  shouldRefresh,
  targetEl,
}: {
  hasZoomImg: boolean;
  imgSrc?: string;
  isSvg: boolean;
  isZoomed: boolean;
  loadedImgEl?: HTMLImageElement;
  offset: number;
  shouldRefresh: boolean;
  targetEl: SupportedImage;
}): StyleObject => {
  const hasScalableSrc = testHasScalableSrc({ hasZoomImg, imgSrc, isSvg });
  const imgRect = targetEl.getBoundingClientRect();
  const targetElComputedStyle = window.getComputedStyle(targetEl);
  const isDivImg = loadedImgEl != null && testDiv(targetEl);
  const isImgObjectFit = loadedImgEl != null && !isDivImg;
  const targetHeight = getTargetDimension({
    fallback: imgRect.height,
    natural: loadedImgEl?.naturalHeight,
  });
  const targetWidth = getTargetDimension({
    fallback: imgRect.width,
    natural: loadedImgEl?.naturalWidth,
  });
  const {
    height: containerHeight,
    left: containerLeft,
    top: containerTop,
    width: containerWidth,
  } = imgRect;
  const position = isDivImg
    ? getDivImgStyle({
        backgroundPosition: targetElComputedStyle.backgroundPosition,
        backgroundSize: targetElComputedStyle.backgroundSize,
        containerHeight,
        containerLeft,
        containerTop,
        containerWidth,
        hasScalableSrc,
        offset,
        targetHeight,
        targetWidth,
      })
    : isImgObjectFit
      ? getImgObjectFitStyle({
          containerHeight,
          containerLeft,
          containerTop,
          containerWidth,
          hasScalableSrc,
          objectFit: targetElComputedStyle.objectFit,
          objectPosition: targetElComputedStyle.objectPosition,
          offset,
          targetHeight,
          targetWidth,
        })
      : getImgRegularStyle({
          containerHeight,
          containerLeft,
          containerTop,
          containerWidth,
          hasScalableSrc,
          offset,
          targetHeight,
          targetWidth,
        });
  const result: StyleObject = {
    top: position.top,
    left: position.left,
    width: position.width,
    height: position.height,
    transform: getModalImgTransform({
      ...position,
      isZoomed,
      userTransform: targetElComputedStyle.transform,
    }),
  };
  if (isZoomed && shouldRefresh) {
    result.transitionDuration = "0.01ms";
  }
  return result;
};
