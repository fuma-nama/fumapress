import type { CSSProperties, ImgHTMLAttributes, InjectionKey, VNodeChild } from "vue";

/** a node, or the `caption` slot of `<ImageZoom />` */
export type Caption = VNodeChild | (() => VNodeChild);

export interface Item {
  element: HTMLElement;
  image: ImgHTMLAttributes;
  caption?: Caption;
}

export interface Slide extends Item {
  style?: CSSProperties;
}

export interface LightboxContextType {
  register: (item: Item) => () => void;
  open: (element: HTMLElement) => void;
}

export const LightboxKey: InjectionKey<LightboxContextType> = Symbol("fd-lightbox");

export function getImageSrc(src: unknown): string {
  if (typeof src === "string") return src;

  if (typeof src === "object" && src !== null) {
    // Next.js
    if ("default" in src) return (src as { default: { src: string } }).default.src;
    return (src as { src: string }).src;
  }

  return "";
}
