/** the languages of a site: the `I18nConfig` of Fumadocs, which its content loader reads */
export interface I18nConfig<Languages extends string = string> {
  /** language codes: each has its pages and its page tree, and is the first segment of their URLs */
  languages: Languages[];
  defaultLanguage: NoInfer<Languages>;
  /**
   * Whether the URLs of a language have no prefix: `default-locale` for the default language only. Languages are told
   * apart by their URL, so every language can't be hidden.
   *
   * @defaultValue "never"
   */
  hideLocale?: "default-locale" | "never";
  /**
   * How files name their language: `page.cn.mdx` with `dot`, `cn/page.mdx` with `dir`.
   *
   * @defaultValue "dot"
   */
  parser?: "dot" | "dir" | "none";
  /** the language shown for a page without a translation, `null` for none @defaultValue `defaultLanguage` */
  fallbackLanguage?: NoInfer<Languages> | null;
}

export function defineI18n<Languages extends string>(
  config: I18nConfig<Languages>,
): I18nConfig<Languages> {
  return config;
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
