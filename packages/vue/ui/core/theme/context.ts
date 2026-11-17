import type { InjectionKey } from "vue";
import type { UseThemeProps } from "./index";

export const ThemeKey: InjectionKey<UseThemeProps> = Symbol("fd-theme");
