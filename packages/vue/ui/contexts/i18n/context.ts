import type { InjectionKey } from "vue";
import type { LocaleContextType } from "./index";

export const LocaleKey: InjectionKey<LocaleContextType> = Symbol("fd-locale");
