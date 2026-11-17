import { inject, type InjectionKey, type Ref } from "vue";
import { baseSlots, type BaseSlotsProps, type LayoutTab, type LinkItemType } from "../shared";
import type { DocsLayoutProps, DocsSlots } from "./index";

export interface SlotsProps extends BaseSlotsProps<DocsLayoutProps> {
  tabs: LayoutTab[];
  aiChat?: DocsLayoutProps["aiChat"];
}

export interface LayoutContext {
  props: Readonly<Ref<SlotsProps>>;
  navItems: Readonly<Ref<LinkItemType[]>>;
  menuItems: Readonly<Ref<LinkItemType[]>>;
  slots: Readonly<Ref<DocsSlots>>;
}

export const LayoutKey: InjectionKey<LayoutContext> = Symbol.for("fd-spacious-layout");

export function useSpaciousLayout(): LayoutContext {
  const context = inject(LayoutKey, null);
  if (!context)
    throw new Error(
      "Please use Spacious layout components under <DocsLayout /> (`@fumapress/vue/ui/layouts/spacious`).",
    );
  return context;
}

export const { useBaseSlots } = baseSlots({
  useProps() {
    return useSpaciousLayout().props;
  },
});
