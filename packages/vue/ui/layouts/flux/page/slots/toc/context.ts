import type { InjectionKey, Ref } from "vue";
import * as TocBlock from "../../../../../components/toc/block";
import * as TocClerk from "../../../../../components/toc/clerk";
import * as TocDefault from "../../../../../components/toc/default";

export const variants = { normal: TocDefault, clerk: TocClerk, block: TocBlock };

export const TocPopoverKey: InjectionKey<{
  open: Readonly<Ref<boolean>>;
  setOpen: (open: boolean) => void;
}> = Symbol.for("fd-flux-toc-popover");
