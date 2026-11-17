import { inject, type ComputedRef, type InjectionKey } from "vue";
import { baseSlots, type BaseSlotsProps, type LinkItemType } from "../shared";
import type { HomeLayoutProps, HomeSlots } from "./index";

export interface HomeLayoutContext {
  props: ComputedRef<BaseSlotsProps<HomeLayoutProps>>;
  navItems: ComputedRef<LinkItemType[]>;
  menuItems: ComputedRef<LinkItemType[]>;
  slots: ComputedRef<HomeSlots>;
}

export const LayoutKey: InjectionKey<HomeLayoutContext> = Symbol("fd-home-layout");

export function useHomeLayout(): HomeLayoutContext {
  const context = inject(LayoutKey, null);
  if (!context)
    throw new Error("Please use this component under <HomeLayout /> (`fumadocs-ui/layouts/home`).");
  return context;
}

export const { useBaseSlots } = baseSlots({
  useProps() {
    return useHomeLayout().props;
  },
});
