import { defineI18n, type I18nConfig } from "fumadocs-core/i18n";
import { uiTranslations } from "fumadocs-ui/i18n";
import type { AppContext, ConfigContext } from "fumapress";
import type { MintlifyDocsJson, MintlifyLanguageNav } from "./schema";

const LOCALE_ALIASES: Record<string, string> = {
  cn: "cn",
  zh: "cn",
  "zh-Hans": "cn",
  en: "en",
  "zh-Hant": "zh-tw",
  jp: "ja",
  "ja-jp": "ja",
  ja: "ja",
  "fr-ca": "fr",
  "fr-CA": "fr",
  fr: "fr",
  "pt-BR": "pt",
  pt: "pt",
  de: "de",
  es: "es",
  ko: "ko",
  it: "it",
  ru: "ru",
};

const LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  cn: "Chinese",
  zh: "Chinese",
  "zh-Hans": "Chinese (Simplified)",
  "zh-Hant": "Chinese (Traditional)",
  ja: "Japanese",
  jp: "Japanese",
  "ja-jp": "Japanese",
  fr: "French",
  "fr-ca": "French (Canada)",
  "fr-CA": "French (Canada)",
  de: "German",
  es: "Spanish",
  ko: "Korean",
  pt: "Portuguese",
  "pt-BR": "Portuguese (Brazil)",
  it: "Italian",
  ru: "Russian",
  ar: "Arabic",
  hi: "Hindi",
  tr: "Turkish",
  nl: "Dutch",
  sv: "Swedish",
  no: "Norwegian",
  da: "Danish",
  pl: "Polish",
  uk: "Ukrainian",
  vi: "Vietnamese",
};

export interface MintlifyI18nOptions {
  /** Override Mintlify -> Fumapress locale mapping */
  localeMap?: Record<string, string>;
  /** Override default language when not specified in docs.json */
  defaultLanguage?: string;
}

export function getMintlifyLanguages(docs: MintlifyDocsJson): MintlifyLanguageNav[] {
  return docs.navigation.languages ?? docs.navigation.global?.languages ?? [];
}

export function mintlifyLocaleToPress(locale: string, options: MintlifyI18nOptions = {}): string {
  const map = { ...LOCALE_ALIASES, ...options.localeMap };
  return map[locale] ?? locale.toLowerCase();
}

export function pressLocaleToMintlify(
  locale: string,
  docs: MintlifyDocsJson,
  options: MintlifyI18nOptions = {},
): string | undefined {
  const languages = getMintlifyLanguages(docs);
  if (languages.length === 0) return locale;

  const reverse = new Map<string, string>();
  for (const entry of languages) {
    reverse.set(mintlifyLocaleToPress(entry.language, options), entry.language);
  }

  return (
    reverse.get(locale) ??
    languages.find((entry) => mintlifyLocaleToPress(entry.language, options) === locale)
      ?.language ??
    languages.find((entry) => entry.default)?.language ??
    languages[0]?.language
  );
}

function languageDisplayName(language: string) {
  return LANGUAGE_LABELS[language] ?? language;
}

export function mintlifyI18n(docs: MintlifyDocsJson, options: MintlifyI18nOptions = {}) {
  const languages = getMintlifyLanguages(docs);
  if (languages.length === 0) {
    throw new Error("[Fumapress Mintlify] docs.json does not define navigation.languages");
  }

  const pressLocales = [
    ...new Set(languages.map((entry) => mintlifyLocaleToPress(entry.language, options))),
  ];
  const defaultMintlify =
    languages.find((entry) => entry.default)?.language ??
    options.defaultLanguage ??
    languages[0]!.language;
  const defaultLanguage = mintlifyLocaleToPress(defaultMintlify, options);

  const i18n = defineI18n({
    languages: pressLocales,
    defaultLanguage,
  });

  const languageDisplayNames = Object.fromEntries(
    pressLocales.map((locale) => {
      const mintlify = pressLocaleToMintlify(locale, docs, options);
      return [locale, { displayName: languageDisplayName(mintlify ?? locale) }];
    }),
  );

  const translations = i18n
    .translations()
    .extend(uiTranslations())
    .add("ui", languageDisplayNames as never);

  return {
    i18n: i18n as I18nConfig<string>,
    translations,
    mapLocale(pageLocale: string | undefined) {
      if (!pageLocale) return pressLocaleToMintlify(defaultLanguage, docs, options);
      return pressLocaleToMintlify(pageLocale, docs, options);
    },
  };
}

export function applyMintlifyTranslations<C extends ConfigContext>(
  ctx: AppContext<C>,
  docs: MintlifyDocsJson,
  options: MintlifyI18nOptions = {},
) {
  const languages = getMintlifyLanguages(docs);
  if (languages.length === 0 || !ctx.translationsConfig) return;

  const languageDisplayNames = Object.fromEntries(
    languages.map((entry) => {
      const locale = mintlifyLocaleToPress(entry.language, options);
      return [locale, { displayName: languageDisplayName(entry.language) }];
    }),
  );

  if ("config" in ctx.translationsConfig) {
    ctx.translationsConfig.add("ui", languageDisplayNames as never);
    return;
  }

  const defaultLocale = mintlifyLocaleToPress(
    languages.find((entry) => entry.default)?.language ?? languages[0]!.language,
    options,
  );
  const fallback = languageDisplayNames[defaultLocale];
  if (fallback) {
    ctx.translationsConfig.add("ui", fallback);
  }
}
