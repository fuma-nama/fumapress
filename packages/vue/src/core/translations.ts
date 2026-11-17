import type {
  I18nConfig,
  SingularTranslationsAPI,
  TranslationExtension,
  TranslationsAPI,
} from "fumadocs-core/i18n";
import { translationKeys, type Translations } from "../../ui/.translations";
import type { SiteI18n } from "./types";

/** the keys of the texts of the UI: the English text, with the note that tells its uses apart */
export function uiTranslations(): TranslationExtension<keyof Translations> {
  return { keys: translationKeys as (keyof Translations)[] };
}

/**
 * What the i18n provider of the UI receives in `lang`: the texts of the UI from `ui.translations`, with the languages
 * of the site. `displayName` of a language names it in the language switch.
 */
export function siteI18n(
  i18n: I18nConfig | undefined,
  translations: TranslationsAPI | SingularTranslationsAPI | undefined,
  lang: string,
): SiteI18n | undefined {
  const t = translations?.extend(uiTranslations());
  const ofLang = (code: string) => (t && "config" in t ? t.get(code) : t?.get());
  if (!i18n) return t && { translations: ofLang(lang) };
  return {
    locale: lang,
    defaultLanguage: i18n.defaultLanguage,
    hideLocale: i18n.hideLocale === "default-locale" ? "default-locale" : "never",
    locales: i18n.languages.map((code) => ({
      locale: code,
      name: (t && "config" in t ? t.get(code)?.displayName : undefined) ?? code,
    })),
    translations: ofLang(lang),
  };
}
