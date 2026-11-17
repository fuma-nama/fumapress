import { inject } from "vue";
import { lookup, REGEX_VAR, TranslationsKey } from "./context";

export { default as T } from "./T.vue";
export { default as TranslationProvider } from "./TranslationProvider.vue";

interface HookOptions {
  /** provide additional context to all t() calls */
  note?: string;
}

export interface TranslationsHook {
  (
    text: string,
    opts?: {
      /**
       * add more context to `text`.
       * @example "The aria-label of close dialog button"
       */
      note?: string;
      variables?: Record<string, string>;
    },
  ): string;
}

/** the translation function: it reads the translations when called, so call it while rendering or in a computed */
export function useTranslations({ note: hookNote }: HookOptions = {}): TranslationsHook {
  const translations = inject(TranslationsKey, undefined);

  return (rawText, { note, variables } = {}) => {
    let text = lookup(translations?.value, rawText, [hookNote, note]);
    if (variables)
      text = text.replaceAll(REGEX_VAR, (m, name: string) => {
        if (m[0] === "\\") return m.slice(1);
        if (name in variables) return variables[name]!;
        return m;
      });
    return text;
  };
}
