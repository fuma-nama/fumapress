import { h, type FunctionalComponent } from "vue";
import type { Highlighter } from "@fumapress/vue/highlight";
import type { CodeBlockProps } from "../codeblock";
import type { Components } from "../../core/utils/hast-to-jsx";
import Base from "./Base.vue";
import DefaultPre from "./DefaultPre.vue";

export { default as DynamicCodeBlock } from "./DynamicCodeBlock.vue";

export interface DynamicCodeblockProps {
  highlighter: Highlighter | (() => Highlighter | PromiseLike<Highlighter>);
  lang: string;
  code: string;
  /**
   * Extra props for the underlying `<CodeBlock />` component.
   *
   * Ignored if you defined your own `pre` component in `options.components`.
   */
  codeblock?: CodeBlockProps;
  /**
   * Render the code as plain lines while the highlighter and the language load, instead of nothing.
   *
   * @defaultValue true
   */
  wrapInSuspense?: boolean;
  options: { components?: Partial<Components> };
}

/**
 * Create a code block that highlights with your own highlighter.
 */
export function createDynamicCodeBlock({ highlighter }: { highlighter: Highlighter }) {
  const DynamicCodeBlock: FunctionalComponent<
    Omit<DynamicCodeblockProps, "highlighter" | "options">
  > = (props) => h(Base, { highlighter, components: { pre: DefaultPre }, ...props });
  DynamicCodeBlock.props = ["lang", "code", "codeblock", "wrapInSuspense"];

  return DynamicCodeBlock;
}
