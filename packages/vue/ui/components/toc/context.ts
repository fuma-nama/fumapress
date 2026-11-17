import type { InjectionKey, Ref } from "vue";
import type { TOCItemType } from "../../core/toc";

export const TOCKey: InjectionKey<Readonly<Ref<TOCItemType[]>>> = Symbol.for("fd-toc-items");
