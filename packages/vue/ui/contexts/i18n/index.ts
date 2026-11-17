import { inject, shallowRef, type Ref } from "vue";
import { LocaleKey } from "./context";

export { default as I18nProvider } from "./I18nProvider.vue";

interface LocaleItem {
  name: string;
  locale: string;
}

export interface LocaleContextType {
  locale: Readonly<Ref<string | undefined>>;
  onChange?: (v: string) => void;
  locales: Readonly<Ref<LocaleItem[] | undefined>>;
}

const defaultContext: LocaleContextType = { locale: shallowRef(), locales: shallowRef() };

export function useI18n(): LocaleContextType {
  return inject(LocaleKey, defaultContext);
}

export interface I18nProviderProps {
  defaultLanguage?: string;
  hideLocale?: "always" | "default-locale" | "never";
  locale?: string;
  onLocaleChange?: (v: string) => void;
  translations?: Partial<Record<string, string>>;
  locales?: LocaleItem[];
}
