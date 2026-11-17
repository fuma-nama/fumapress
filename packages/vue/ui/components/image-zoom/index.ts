import type { ImgHTMLAttributes, VNode } from "vue";
import type { ImageProps } from "../../core/framework";
import type { UncontrolledProps } from "./zoom";
import "./image-zoom.css";

export { default as ImageZoom } from "./ImageZoom.vue";
/**
 * Browse the zoomable images inside in one viewer
 */
export { default as Lightbox } from "./Lightbox.vue";

/**
 * Other attributes (like `title`) go to the image. The default slot replaces the image.
 */
export interface ImageZoomProps extends ImageProps {
  /**
   * Image props when zoom in
   */
  zoomInProps?: ImgHTMLAttributes;

  /**
   * Props for the `Zoom` of `react-medium-image-zoom`, unused inside `<Lightbox />`
   */
  rmiz?: UncontrolledProps;

  /**
   * Caption in `<Lightbox />`, or the slot `caption`
   *
   * @defaultValue `title`
   */
  caption?: string | VNode;
}
