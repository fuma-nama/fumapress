import { inject, type InjectionKey, type Ref } from "vue";
import { baseSlots, type BaseSlotsProps, type LayoutTab, type LinkItemType } from "../../shared";
import type { DocsLayoutProps } from "../index";
import type { SidebarProps } from "../slots/sidebar";
import type { DocsSlots } from "./index";

export interface SlotsProps extends BaseSlotsProps<DocsLayoutProps> {
  sidebar: SidebarProps;
  tabMode: NonNullable<DocsLayoutProps["tabMode"]>;
  tabs: LayoutTab[];
  aiChat?: DocsLayoutProps["aiChat"];
}

export interface LayoutContext {
  props: Readonly<Ref<SlotsProps>>;
  isNavTransparent: Readonly<Ref<boolean>>;
  navItems: Readonly<Ref<LinkItemType[]>>;
  menuItems: Readonly<Ref<LinkItemType[]>>;
  slots: Readonly<Ref<DocsSlots>>;
}

export const LayoutKey: InjectionKey<LayoutContext> = Symbol.for("fd-notebook-layout");

export function useNotebookLayout() {
  const context = inject(LayoutKey, null);
  if (!context)
    throw new Error(
      "Please use <DocsPage /> (`@fumapress/vue/ui/layouts/notebook/page`) under <DocsLayout /> (`@fumapress/vue/ui/layouts/notebook`).",
    );
  return context;
}

export const { useBaseSlots } = baseSlots({
  useProps() {
    return useNotebookLayout().props;
  },
});
