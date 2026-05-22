"use client";

import { defaultTranslations, type Translations } from "@/i18n";
import { renderTranslation, type TranslationValue } from "fumadocs-core/i18n";
import { useTranslations as useTranslationsBase } from "fumadocs-ui/contexts/i18n";

export function useFumapressTranslations(): Translations {
  return useTranslationsBase<Translations>("fumapress") ?? defaultTranslations;
}

/**
 * Renders a translated string. Use in server components so the label is resolved on the client from the current locale.
 */
export function I18nLabel<K extends keyof Translations>({
  label,
  replacements,
}: {
  label: K;
  replacements?: Translations[K] extends TranslationValue<infer Params>
    ? Record<Params, string>
    : never;
}): string {
  const text = useFumapressTranslations();
  return renderTranslation(text[label], replacements!);
}
