import type { I18nConfig } from "fumadocs-core/i18n";
import { createElement, type FC } from "react";
import { joinPathname } from "./pathname";

/** route group of pages without a language prefix, rendered inside the root layout of the default language */
export const DEFAULT_GROUP = "/(default)";

/** the language served without URL prefix */
export function hiddenLocale(i18n: I18nConfig | undefined): string | undefined {
  return i18n?.hideLocale === "default-locale" ? i18n.defaultLanguage : undefined;
}

export function localizePath(
  i18n: I18nConfig | undefined,
  lang: string | undefined,
  pathname: string,
): string {
  if (!i18n || !lang || lang === hiddenLocale(i18n)) return pathname;
  return joinPathname(lang, pathname);
}

export interface LocaleRoute {
  /** route prefix of the language: `/${lang}`, or `DEFAULT_GROUP` when its prefix is hidden */
  base: string;
  lang: string;
}

/** the route of every language, register pages under `base` with `lang` fixed by `withLang()` */
export function localeRoutes(i18n: I18nConfig): LocaleRoute[] {
  const hidden = hiddenLocale(i18n);
  const routes: LocaleRoute[] = [];
  for (const lang of i18n.languages) {
    routes.push({ base: lang === hidden ? DEFAULT_GROUP : `/${lang}`, lang });
  }
  return routes;
}

/**
 * Fix the `lang` prop of a route component.
 *
 * Server components are called in place, so the Markdown renderer of llms.txt still sees their `asMarkdown()` call.
 */
export function withLang<P extends object>(
  component: FC<P & { lang?: string }>,
  lang: string,
): FC<P> {
  if (typeof component === "function" && !("$$typeof" in component)) {
    return (props) => component({ ...props, lang });
  }

  return (props) => createElement(component, { ...props, lang });
}
