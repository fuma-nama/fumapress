import { inject, type Component, type Ref } from "vue";
import { defaultContext, SearchKey } from "./context";

export { default as SearchOnly } from "./SearchOnly.vue";
export { default as SearchProvider } from "./SearchProvider.vue";

export interface HotKey {
  /** a text, or a component to render */
  display: string | Component;

  /**
   * Key code or a function determining whether the key is pressed.
   */
  key: string | ((e: KeyboardEvent) => boolean);
}

/** the props every search dialog receives, it emits `update:open` to open or close itself */
export interface SharedProps {
  open: boolean;
}

export type SearchLink = [name: string, href: string];

export interface TagItem {
  name: string;
  value: string;
}

export interface SearchProviderProps {
  /**
   * Preload search dialog before opening it
   *
   * @defaultValue `true`
   */
  preload?: boolean;

  /**
   * Custom links to be displayed if search is empty
   */
  links?: SearchLink[];

  /**
   * Hotkeys for triggering search dialog
   *
   * @defaultValue Meta/Ctrl + K
   */
  hotKey?: HotKey[];

  /**
   * Replace default search dialog, allowing you to use other solutions such as Algolia Search
   *
   * It receives the `open` prop and emits `update:open`, can be lazy loaded with `defineAsyncComponent()`
   */
  SearchDialog?: Component;

  /**
   * Additional props to the dialog
   */
  options?: Record<string, unknown>;
}

export interface SearchContextType {
  enabled: boolean;
  open: Readonly<Ref<boolean>>;
  hotKey: Readonly<Ref<HotKey[]>>;
  setOpenSearch: (value: boolean) => void;
}

export function useSearchContext(): SearchContextType {
  return inject(SearchKey, defaultContext);
}
