import { createLinkItemRenderer } from "../../../../components/sidebar/link-item";
import { createPageTreeRenderer } from "../../../../components/sidebar/page-tree";
import * as Base from "../../../../components/sidebar/base";
import SidebarFolderContent from "./SidebarFolderContent.vue";
import SidebarFolderLink from "./SidebarFolderLink.vue";
import SidebarFolderTrigger from "./SidebarFolderTrigger.vue";
import SidebarItem from "./SidebarItem.vue";
import SidebarSeparator from "./SidebarSeparator.vue";

export const SidebarPageTree = createPageTreeRenderer({
  SidebarFolder: Base.SidebarFolder,
  SidebarFolderContent,
  SidebarFolderLink,
  SidebarFolderTrigger,
  SidebarItem,
  SidebarSeparator,
});

export const SidebarLinkItem = createLinkItemRenderer({
  SidebarFolder: Base.SidebarFolder,
  SidebarFolderContent,
  SidebarFolderLink,
  SidebarFolderTrigger,
  SidebarItem,
});
