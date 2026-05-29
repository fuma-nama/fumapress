import { defineI18n } from "fumadocs-core/i18n";
import type { MintlifyDocsJson, MintlifyLanguageNav } from "./schema";

/** Mintlify locale -> display name */
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

export interface I18nConfigExtended {
  _getMintlifyLanguage?: (locale: string) => string | undefined;
}

export function getMintlifyLanguages(docs: MintlifyDocsJson): MintlifyLanguageNav[] {
  return docs.navigation.languages ?? docs.navigation.global?.languages ?? [];
}

export function defineMintlifyI18n(docs: MintlifyDocsJson, options: MintlifyI18nOptions = {}) {
  const { localeMap } = options;
  const languageEntries = getMintlifyLanguages(docs);
  if (languageEntries.length === 0) {
    throw new Error("[Fumapress Mintlify] docs.json does not define navigation.languages");
  }

  function toPressLocale(mintlifyLocale: string) {
    return localeMap?.[mintlifyLocale] ?? mintlifyLocale;
  }

  function getMintlifyLanguage(locale: string) {
    return pressLocaleToMintlify.get(locale);
  }

  const pressLocaleToMintlify = new Map<string, string>();

  for (const entry of languageEntries) {
    pressLocaleToMintlify.set(toPressLocale(entry.language), entry.language);
  }

  const languages = Array.from(pressLocaleToMintlify.keys());
  const defaultLanguage =
    options.defaultLanguage ??
    languageEntries.find((entry) => entry.default)?.language ??
    languageEntries[0]!.language;

  const i18n = defineI18n({
    languages,
    defaultLanguage: toPressLocale(defaultLanguage),
  });

  (i18n as I18nConfigExtended)._getMintlifyLanguage = getMintlifyLanguage;

  const createTranslations = i18n.translations;
  i18n.translations = () => {
    const t = createTranslations();

    for (const entry of languageEntries) {
      const displayName = LANGUAGE_LABELS[entry.language];
      if (!displayName) continue;

      t.preset(toPressLocale(entry.language), {
        name: "fumapress:mintlify",
        value: {
          ui: {
            displayName,
          },
        },
      });
    }

    return t;
  };
  return i18n;
}
