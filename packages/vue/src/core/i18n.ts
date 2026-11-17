import type { I18nConfig } from "fumadocs-core/i18n";

/** the direction of the text of a language, `ltr` when it is unknown */
export function directionOf(lang: string): "ltr" | "rtl" {
  try {
    // a method in recent runtimes, a getter in older ones
    const locale = new Intl.Locale(lang) as Intl.Locale & {
      getTextInfo?: () => { direction?: string };
      textInfo?: { direction?: string };
    };
    const info = locale.getTextInfo?.() ?? locale.textInfo;
    return info?.direction === "rtl" ? "rtl" : "ltr";
  } catch {
    // not a language tag
    return "ltr";
  }
}

/** what tells the language of a URL: on the server and in the browser */
export type LocaleRules = Pick<I18nConfig, "languages" | "defaultLanguage" | "hideLocale">;

/** `pathname` in a language: with its prefix, unless the language is hidden */
export function localizePath(
  i18n: LocaleRules | undefined,
  lang: string,
  pathname: string,
): string {
  if (!i18n || (i18n.hideLocale === "default-locale" && lang === i18n.defaultLanguage)) {
    return pathname;
  }
  return pathname === "/" ? `/${lang}` : `/${lang}${pathname}`;
}

/** the language of a URL, and the URL without its prefix; no language when the URL needs a prefix and has none */
export function localeOf(
  i18n: LocaleRules,
  pathname: string,
): { lang: string | undefined; pathname: string } {
  const [, first = "", ...rest] = pathname.split("/");
  const hidden = i18n.hideLocale === "default-locale" ? i18n.defaultLanguage : undefined;
  if (first !== hidden && i18n.languages.includes(first)) {
    return { lang: first, pathname: `/${rest.join("/")}` };
  }
  return { lang: hidden, pathname };
}
