import type { I18nProviderProps } from "../../contexts/i18n";
import type { SearchProviderProps } from "../../contexts/search";

export { default as RootProvider } from "./RootProvider.vue";
export { useTheme, type UseThemeProps } from "../../core/theme";

interface SearchOptions extends SearchProviderProps {
  /**
   * Enable search functionality
   *
   * @defaultValue `true`
   */
  enabled?: boolean;
}

interface ThemeOptions {
  /**
   * Enable the theme provider
   *
   * @defaultValue true
   */
  enabled?: boolean;

  /**
   * Hotkey for toggling between light/dark mode, pass `false` to disable it.
   *
   * It is ignored while typing in an editable element (e.g. `<input />`), or when a dialog is opened.
   *
   * @defaultValue `d`
   */
  hotKey?: string | ((e: KeyboardEvent) => boolean) | false;
}

export interface RootProviderProps {
  /**
   * `dir` option for Reka UI
   */
  dir?: "rtl" | "ltr";

  /**
   * @remarks `SearchProviderProps`
   */
  search?: Partial<SearchOptions>;

  /**
   * Customize options of the theme provider
   */
  theme?: ThemeOptions;

  i18n?: I18nProviderProps;
}
