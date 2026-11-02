import type { I18nConfig } from "fumadocs-core/i18n";
import type { LoaderConfig, LoaderOutput, Page } from "fumadocs-core/source";
import { joinPaths } from "./pathname";

/**
 * the page this one is inherited from when the locale has no file of its own, pages shared by every language (`$`) count too
 *
 * Translations are told apart by their file path: the loader assigns a file to a language by its
 * `.{locale}` suffix, so two languages share a `path` only when they share the file.
 */
export function inheritedFrom(
  source: Pick<LoaderOutput<LoaderConfig>, "getPage">,
  i18n: I18nConfig | undefined,
  page: Page,
): Page | undefined {
  if (!i18n) return;
  const lang = i18n.fallbackLanguage ?? i18n.defaultLanguage;
  if (page.locale === lang) return;
  const origin = source.getPage(page.slugs, lang);
  if (origin?.path === page.path) return origin;
}

export function localizePath(
  i18n: I18nConfig | undefined,
  lang: string | undefined,
  pathname: string,
): string {
  if (!i18n || !lang || (i18n.hideLocale === "default-locale" && lang === i18n.defaultLanguage)) {
    return pathname;
  }
  return joinPaths(`/${lang}`, pathname);
}
