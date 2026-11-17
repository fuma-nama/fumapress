import { shallowRef, type InjectionKey } from "vue";
import MetaOrControl from "./MetaOrControl.vue";
import type { HotKey, SearchContextType } from "./index";

export const SearchKey: InjectionKey<SearchContextType> = Symbol.for("fd-search");

export const defaultContext: SearchContextType = {
  enabled: false,
  open: shallowRef(false),
  hotKey: shallowRef([]),
  setOpenSearch: () => undefined,
};

export const DEFAULT_HOT_KEYS: HotKey[] = [
  {
    key: (e) => e.metaKey || e.ctrlKey,
    display: MetaOrControl,
  },
  {
    key: "k",
    display: "K",
  },
];
