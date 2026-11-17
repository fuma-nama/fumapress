import type { HTMLAttributes } from "vue";
// a named import: the compiler of `.vue` files doesn't resolve a type of a namespace import
import type { TOCProviderProps as BaseTOCProviderProps } from "../../../../../components/toc";

export { default as TOCProvider } from "./TOCProvider.vue";
export { default as TOC } from "./TOC.vue";

export type TOCProviderProps = BaseTOCProviderProps;

/**
 * The slots `header` and `footer` are custom content in TOC container, before and after the main TOC
 */
export interface TOCProps {
  container?: HTMLAttributes;
}
