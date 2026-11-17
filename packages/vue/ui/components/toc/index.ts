import { inject, shallowRef, type Ref } from "vue";
import type { AnchorProviderProps, TOCItemType } from "../../core/toc";
import { TOCKey } from "./context";

export { useActiveAnchor, useActiveAnchors, useItems } from "../../core/toc";
export { default as TOCProvider } from "./TOCProvider.vue";
export { default as TOCScrollArea } from "./TOCScrollArea.vue";

export function useTOCItems(): Readonly<Ref<TOCItemType[]>> {
  return inject(TOCKey, shallowRef([]));
}

export type TOCProviderProps = AnchorProviderProps;
