import type { ButtonHTMLAttributes, HTMLAttributes } from "vue";
import type * as Base from "../../../../../components/toc";
import type * as TocBlock from "../../../../../components/toc/block";
import type * as TocClerk from "../../../../../components/toc/clerk";
import type * as TocDefault from "../../../../../components/toc/default";

export { TOCProvider } from "../../../../../components/toc";
export { default as TOC } from "./TOC.vue";

export type TOCProviderProps = Base.TOCProviderProps;

/**
 * The slots `header` and `footer` are custom content in TOC container, before and after the main TOC
 */
export type TOCProps = {
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
