import { inject, shallowRef, type Ref } from "vue";
import { ThemeKey } from "./context";

export { default as ThemeProvider } from "./ThemeProvider.vue";

export interface UseThemeProps {
  /** active theme name: `light`, `dark` or `system`, `undefined` on the server and until mounted */
  theme: Readonly<Ref<string | undefined>>;
  /** `light` or `dark`: the system preference when `theme` is `system`, `undefined` on the server and until mounted */
  resolvedTheme: Readonly<Ref<string | undefined>>;
  /** update the theme */
  setTheme: (theme: string) => void;
}

const defaultContext: UseThemeProps = {
  theme: shallowRef(),
  resolvedTheme: shallowRef(),
  setTheme: () => {},
};

export function useTheme(): UseThemeProps {
  return inject(ThemeKey, defaultContext);
}
