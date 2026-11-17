import type { ButtonHTMLAttributes, HTMLAttributes } from "vue";
import type { TOCProviderProps as BaseTOCProviderProps } from "../../../../../components/toc";
import type * as TocBlock from "../../../../../components/toc/block";
import type * as TocClerk from "../../../../../components/toc/clerk";
import type * as TocDefault from "../../../../../components/toc/default";

export { default as TOCProvider } from "./TOCProvider.vue";
export { default as TOC } from "./TOC.vue";
export { default as TOCPopover } from "./TOCPopover.vue";
export { default as TOCDropdown } from "./TOCDropdown.vue";

// a named import: the compiler of Vue doesn't resolve a type through a namespace
export type TOCProviderProps = BaseTOCProviderProps;

type TOCStyle =
  | { style?: "block"; list?: TocBlock.TOCItemsProps }
  | { style: "normal"; list?: TocDefault.TOCItemsProps }
  | { style: "clerk"; list?: TocClerk.TOCItemsProps };

/**
 * The slots `header` and `footer` are custom content in TOC container, before and after the main TOC
 */
export type TOCProps = TOCStyle & { container?: HTMLAttributes };

/**
 * The slots `header` and `footer` are custom content in TOC container, before and after the main TOC
 */
export type TOCDropdownProps = TOCStyle & {
  trigger?: ButtonHTMLAttributes;
  content?: HTMLAttributes;
};

/**
 * The slots `header` and `footer` are custom content in TOC container, before and after the main TOC
 */
export type TOCPopoverProps = TOCDropdownProps & { container?: HTMLAttributes };
