import {
  defineComponent,
  Fragment,
  h,
  inject,
  provide,
  toRef,
  type Component,
  type InjectionKey,
  type PropType,
  type Ref,
} from "vue";
import type * as PageTree from "@fumapress/vue/page-tree";
import { useTreeContext, useTreePath } from "../../../contexts/tree";
import { usePathname } from "../../../core/framework";
import { isActive } from "../../../utils/urls";
import { RenderNode } from "../../../layouts/shared";
import type * as Base from "../base";

export interface SidebarPageTreeComponents {
  /** receives the page as `item` */
  Item: Component;
  /** receives the folder as `item`, and its nodes as the default slot */
  Folder: Component;
  /** receives the separator as `item` */
  Separator: Component;
}

const RendererKey: InjectionKey<{
  Item: Readonly<Ref<Component | undefined>>;
  Folder: Readonly<Ref<Component | undefined>>;
  Separator: Readonly<Ref<Component | undefined>>;
  pathname: Readonly<Ref<string>>;
}> = Symbol("fd-sidebar-page-tree");

type InternalComponents = Record<
  keyof Pick<
    typeof Base,
    | "SidebarSeparator"
    | "SidebarFolder"
    | "SidebarFolderLink"
    | "SidebarFolderContent"
    | "SidebarFolderTrigger"
    | "SidebarItem"
  >,
  Component
>;

const component = { type: [Object, Function] as PropType<Component> };

export function createPageTreeRenderer({
  SidebarFolder,
  SidebarFolderContent,
  SidebarFolderLink,
  SidebarFolderTrigger,
  SidebarSeparator,
  SidebarItem,
}: InternalComponents) {
  function renderList(nodes: PageTree.Node[]) {
    return nodes.map((node, i) => h(PageTreeNode, { key: i, node }));
  }

  const PageTreeNode: Component = defineComponent({
    name: "PageTreeNode",
    props: { node: { type: Object as PropType<PageTree.Node>, required: true } },
    setup(props) {
      const { Separator, Item, Folder, pathname } = inject(RendererKey)!;
      const path = useTreePath();

      return () => {
        const node = props.node;

        if (node.type === "separator") {
          if (Separator.value) return h(Separator.value, { item: node });
          return h(SidebarSeparator, null, () => [h(RenderNode, { node: node.icon }), node.name]);
        }

        if (node.type === "folder") {
          if (Folder.value) return h(Folder.value, { item: node }, () => renderList(node.children));

          return h(
            SidebarFolder,
            {
              collapsible: node.collapsible,
              active: path.value.includes(node),
              defaultOpen: node.defaultOpen,
            },
            () => [
              node.index
                ? h(
                    SidebarFolderLink,
                    {
                      href: node.index.url,
                      active: isActive(node.index.url, pathname.value),
                      external: node.index.external,
                    },
                    () => [h(RenderNode, { node: node.icon }), node.name],
                  )
                : h(SidebarFolderTrigger, null, () => [
                    h(RenderNode, { node: node.icon }),
                    node.name,
                  ]),
              h(SidebarFolderContent, null, () => renderList(node.children)),
            ],
          );
        }

        if (Item.value) return h(Item.value, { item: node });
        return h(
          SidebarItem,
          {
            href: node.url,
            external: node.external,
            active: isActive(node.url, pathname.value),
          },
          // the `icon` slot of `SidebarItem` has a default
          node.icon
            ? { icon: () => h(RenderNode, { node: node.icon }), default: () => node.name }
            : { default: () => node.name },
        );
      };
    },
  });

  /**
   * Render sidebar items from page tree
   */
  return defineComponent({
    name: "SidebarPageTree",
    props: { Item: component, Folder: component, Separator: component },
    setup(props) {
      const { root } = useTreeContext();
      const pathname = usePathname();

      provide(RendererKey, {
        Item: toRef(props, "Item"),
        Folder: toRef(props, "Folder"),
        Separator: toRef(props, "Separator"),
        pathname,
      });

      return () => h(Fragment, { key: root.value.$id }, renderList(root.value.children));
    },
  });
}
