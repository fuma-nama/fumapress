import type { TranslationExtension } from "fumadocs-core/i18n";
import translationKeys from "@/.translations/keys.json";
import type { Translations } from "@/.translations";

export type { Translations };

export function feedbackTranslations(): TranslationExtension<keyof Translations> {
  return { keys: translationKeys as never };
}
