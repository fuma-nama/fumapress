import type { DynamicCodeblockProps as BaseProps } from "../dynamic-codeblock.core";

export { default as DynamicCodeBlock } from "./DynamicCodeBlock.vue";

export type DynamicCodeblockProps = Omit<BaseProps, "highlighter" | "options"> & {
  options?: BaseProps["options"];
};
