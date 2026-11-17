import type { ComputedRef, InjectionKey } from "vue";
import type * as PageTree from "@fumapress/vue/page-tree";
import type { TreeContextType } from "./index";

export const TreeKey: InjectionKey<TreeContextType> = Symbol("fd-tree");
export const PathKey: InjectionKey<ComputedRef<PageTree.Node[]>> = Symbol("fd-tree-path");
