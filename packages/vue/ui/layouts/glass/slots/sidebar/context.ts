import { inject, type InjectionKey, type Ref } from "vue";
import { cva } from "class-variance-authority";
import type * as PageTree from "@fumapress/vue/page-tree";
import * as Drawer from "../../../../primitives/drawer";

export const drawerHandle = Drawer.createHandle();

export const itemTriggerVariants = cva(
  "inline-flex items-center gap-2 rounded-lg px-2.5 py-2 md:py-1.5 [&_svg]:size-4 outline-none focus-visible:ring-2 focus-visible:ring-fd-ring",
  {
    variants: {
      active: {
        true: "bg-fd-primary/10 text-fd-primary",
        false: "text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-accent-foreground",
      },
    },
  },
);

export interface SidebarContext {
  collapsible: Readonly<Ref<boolean>>;
  collapsed: Readonly<Ref<boolean>>;
  setCollapsed: (v: boolean) => void;
}

export const SidebarKey: InjectionKey<SidebarContext> = Symbol.for("fd-glass-sidebar");

export function useSidebar(): SidebarContext {
  const v = inject(SidebarKey, null);
  if (!v) throw new Error("Missing <SidebarProvider />");
  return v;
}

export function isNodeInPath(node: PageTree.Node, path: PageTree.Node[]) {
  return path.some((other) => other === node || (node.$id !== undefined && other.$id === node.$id));
}
