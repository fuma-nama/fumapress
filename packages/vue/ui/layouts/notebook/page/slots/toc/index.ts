import type { ButtonHTMLAttributes, HTMLAttributes } from "vue";
import type { TOCProviderProps as BaseTOCProviderProps } from "../../../../../components/toc";
import type * as TocBlock from "../../../../../components/toc/block";
import type * as TocClerk from "../../../../../components/toc/clerk";
import type * as TocDefault from "../../../../../components/toc/default";

export { default as TOCProvider } from "./TOCProvider.vue";
export { default as TOC } from "./TOC.vue";
export { default as TOCPopover } from "./TOCPopover.vue";

export type TOCProviderProps = BaseTOCProviderProps;

/**
 * The slots `header` and `footer` are custom content in TOC container, before and after the main TOC
 */
export type TOCProps = {
  container?: HTMLAttributes;
} & (
  | {
      style?: "normal";
      list?: TocDefault.TOCItemsProps;
    }
  | {
      style: "clerk";
      list?: TocClerk.TOCItemsProps;
    }
  | {
      style: "block";
      list?: TocBlock.TOCItemsProps;
    }
);

/**
 * The slots `header` and `footer` are custom content in TOC container, before and after the main TOC
 */
export type TOCPopoverProps = {
  container?: HTMLAttributes;
  trigger?: ButtonHTMLAttributes;
  content?: HTMLAttributes;
} & (
  | {
      style?: "normal";
      list?: TocDefault.TOCItemsProps;
    }
  | {
      style: "clerk";
      list?: TocClerk.TOCItemsProps;
    }
  | {
      style: "block";
      list?: TocBlock.TOCItemsProps;
    }
);
