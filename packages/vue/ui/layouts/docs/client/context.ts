import { inject, type InjectionKey, type Ref } from "vue";
import { baseSlots, type BaseSlotsProps, type LayoutTab, type LinkItemType } from "../../shared";
import type { DocsLayoutProps } from "../index";
import type { DocsSlots } from "./index";

export interface SlotsProps extends BaseSlotsProps<DocsLayoutProps> {
  tabs: LayoutTab[];
  tabMode: NonNullable<DocsLayoutProps["tabMode"]>;
  aiChat?: DocsLayoutProps["aiChat"];
}

export interface LayoutContext {
  props: Readonly<Ref<SlotsProps>>;
  isNavTransparent: Readonly<Ref<boolean>>;
  navItems: Readonly<Ref<LinkItemType[]>>;
  menuItems: Readonly<Ref<LinkItemType[]>>;
  slots: Readonly<Ref<DocsSlots>>;
}

export const LayoutKey: InjectionKey<LayoutContext> = Symbol("fd-docs-layout");

export function useIsDocsLayout() {
  return inject(LayoutKey, null) !== null;
}

export function useDocsLayout() {
  const context = inject(LayoutKey, null);
  if (!context)
    throw new Error(
      "Please use <DocsPage /> (`@fumapress/vue/ui/layouts/docs/page`) under <DocsLayout /> (`@fumapress/vue/ui/layouts/docs`).",
    );
  return context;
}

export const { useBaseSlots } = baseSlots({
  useProps() {
    return useDocsLayout().props;
  },
});
