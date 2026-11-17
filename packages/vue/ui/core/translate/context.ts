import type { InjectionKey, Ref } from "vue";

export type TranslationValues = Partial<Record<string, string>>;

export const TranslationsKey: InjectionKey<Readonly<Ref<TranslationValues>>> =
  Symbol("fd-translations");

export const REGEX_VAR = /\\?\{([^}]+)\}/g;

/** the translation of a text, the text itself without one */
export function lookup(
  translations: TranslationValues | undefined,
  rawText: string,
  notes: (string | undefined)[],
): string {
  const key = rawText + notes.map((note) => (note ? `(${note})` : "")).join("");
  return translations?.[key] ?? rawText;
}
