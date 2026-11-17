import {
  defineI18n as defineFumadocsI18n,
  type I18nAPI,
  type I18nConfig,
} from "fumadocs-core/i18n";

export { defineTranslations } from "fumadocs-core/i18n";
export type {
  I18nAPI,
  I18nConfig,
  SingularTranslationsAPI,
  TranslationExtension,
  TranslationPreset,
  TranslationsAPI,
} from "fumadocs-core/i18n";
export { uiTranslations } from "./core/translations";
export type { Translations } from "../ui/.translations";

/**
 * The languages of a site, for the `i18n` option of `createPress()`: `defineI18n` of Fumadocs, without
 * `hideLocale: "always"`, since the languages of a site are told apart by their URL.
 */
export function defineI18n<const Languages extends string>(
  config: I18nConfig<Languages> & { hideLocale?: "default-locale" | "never" },
): I18nAPI<Languages> {
  return defineFumadocsI18n(config);
}
