import { defineComponent, h, type Component, type PropType } from "vue";
import { usePathname } from "../../../core/framework";
import { isLinkItemActive, RenderNode, type LinkItemType } from "../../../layouts/shared";
import type * as Base from "../base";

type InternalComponents = Record<
  keyof Pick<
    typeof Base,
    | "SidebarFolder"
    | "SidebarFolderLink"
    | "SidebarFolderContent"
    | "SidebarFolderTrigger"
    | "SidebarItem"
  >,
  Component
>;

type Item = Exclude<LinkItemType, { type: "icon" }>;

const render = (node: string | Component | undefined) => h(RenderNode, { node });

export function createLinkItemRenderer({
  SidebarFolder,
  SidebarFolderContent,
  SidebarFolderLink,
  SidebarFolderTrigger,
  SidebarItem,
}: InternalComponents) {
  /**
   * Render sidebar items from page tree
   */
  const SidebarLinkItem: Component = defineComponent({
    name: "SidebarLinkItem",
    props: { item: { type: Object as PropType<Item>, required: true } },
    setup(props) {
      const pathname = usePathname();

      return () => {
        const item = props.item;
        const active = isLinkItemActive(item, pathname.value);
        if (item.type === "custom") return h("div", null, [render(item.children)]);

        if (item.type === "menu")
          return h(SidebarFolder, null, () => [
            item.url
              ? h(SidebarFolderLink, { href: item.url, active, external: item.external }, () => [
                  render(item.icon),
                  render(item.text),
                ])
              : h(SidebarFolderTrigger, null, () => [render(item.icon), render(item.text)]),
            h(SidebarFolderContent, null, () =>
              item.items.map((child, i) => h(SidebarLinkItem, { key: i, item: child })),
            ),
          ]);

        return h(
          SidebarItem,
          { href: item.url, external: item.external, active },
          // the `icon` slot of `SidebarItem` has a default
          item.icon
            ? { icon: () => render(item.icon), default: () => render(item.text) }
            : { default: () => render(item.text) },
        );
      };
    },
  });

  return SidebarLinkItem;
}
