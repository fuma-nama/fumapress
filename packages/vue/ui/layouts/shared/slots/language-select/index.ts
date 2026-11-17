import type { HTMLAttributes } from "vue";
import type { ButtonProps } from "../../../../components/ui/button";

export { default as LanguageSelect } from "./LanguageSelect.vue";
export { default as LanguageSelectText } from "./LanguageSelectText.vue";

export interface LanguageSelectProps {
  variant?: ButtonProps["variant"];
  class?: HTMLAttributes["class"];
}

/** the attributes of a `<span>` */
export type LanguageSelectTextProps = HTMLAttributes;
