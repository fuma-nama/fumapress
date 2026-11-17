export { default as Link, default } from "./Link.vue";

export interface LinkProps {
  href?: string;

  /**
   * If the href is an external URL
   *
   * automatically determined by default
   */
  external?: boolean;

  /**
   * Prefetch links
   */
  prefetch?: boolean;
}
