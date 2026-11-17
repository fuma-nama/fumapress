import { inject, type InjectionKey, type Ref } from "vue";

export interface TOCContext {
  open: Readonly<Ref<boolean>>;
  inAnimation: Readonly<Ref<boolean>>;
  setMobileOpen: (v: boolean) => void;
}

export const TOCContextKey: InjectionKey<TOCContext> = Symbol.for("fd-glass-toc");

export function useContext(): TOCContext {
  return inject(TOCContextKey)!;
}
