import { computed, inject, toValue, type ComputedRef, type MaybeRefOrGetter, type Ref } from "vue";
import * as PageTree from "@fumapress/vue/page-tree";
import { PathKey, TreeKey } from "./context";

export { default as TreeContextProvider } from "./TreeContextProvider.vue";

export interface TreeContextType {
  root: Readonly<Ref<(PageTree.Root | PageTree.Folder) & { $id: string }>>;
  full: Readonly<Ref<PageTree.Root>>;
}

const emptyPath = computed<PageTree.Node[]>(() => []);

export function useTreePath(): ComputedRef<PageTree.Node[]> {
  return inject(PathKey, emptyPath);
}

export function useTreeContext(): TreeContextType {
  const ctx = inject(TreeKey, null);

  if (!ctx) throw new Error("You must wrap this component under <DocsLayout />");
  return ctx;
}

/** the part of `LayoutTab` (`layouts/shared`) read here */
interface Tab {
  url: string;
  $folder?: PageTree.Folder;
}

export interface TabsGroup<T extends Tab = Tab> {
  /** the root folder on the current page's path, undefined for tabs not bound to the page tree */
  active?: PageTree.Folder;
  options: T[];
}

/**
 * Group tabs by the root folders on the current page's path (outermost first): each tab is
 * matched to its root folder, linking to the projection of current page when possible.
 *
 * Tabs not bound to the page tree are appended to the group of `root: true` folders.
 */
export function useTabsGroups<T extends Tab>(
  tabs: MaybeRefOrGetter<T[]>,
): ComputedRef<TabsGroup<T>[]> {
  const { full } = useTreeContext();
  const path = useTreePath();

  return computed(() => {
    const tree = full.value;
    const list = toValue(tabs);
    const out: TabsGroup<T>[] = [];
    const last = path.value[path.value.length - 1];
    const page = last?.type === "page" ? last : undefined;
    // the fallback tree shares the same scope as the main tree
    let scope = tree.fallback ? [...tree.children, ...tree.fallback.children] : tree.children;

    for (const node of path.value) {
      if (node.type !== "folder" || !node.root) continue;
      const group: TabsGroup<T> = { active: node, options: [] };
      collectTabs(scope, node, page, list, group.options);
      if (group.options.length > 0) out.push(group);
      scope = node.children;
    }

    const custom = list.filter((tab) => !tab.$folder);
    if (custom.length > 0) {
      const group = out.findLast((group) => group.active?.root === true);
      if (group) group.options.push(...custom);
      else out.push({ options: custom });
    }

    return out;
  });
}

/** collect the tabs of root folders with the same type as `active` within a scope */
function collectTabs<T extends Tab>(
  scope: PageTree.Node[],
  active: PageTree.Folder,
  page: PageTree.Item | undefined,
  tabs: T[],
  out: T[],
) {
  for (const node of scope) {
    if (node.type !== "folder") continue;
    if (node.root === active.root) {
      const tab = tabs.find(
        (tab) => tab.$folder && (tab.$folder === node || tab.$folder.$id === node.$id),
      );
      if (!tab) continue;

      const projection = page && PageTree.findProjection(active, node, page);
      out.push(projection ? { ...tab, url: projection.url } : tab);
    } else if (!node.root) {
      // any other root folder starts a new scope
      collectTabs(node.children, active, page, tabs, out);
    }
  }
}
