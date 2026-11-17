import { createLinkItemRenderer } from "../../../../components/sidebar/link-item";
import { createPageTreeRenderer } from "../../../../components/sidebar/page-tree";
import SidebarFolder from "./SidebarFolder.vue";
import SidebarFolderContent from "./SidebarFolderContent.vue";
import SidebarFolderLink from "./SidebarFolderLink.vue";
import SidebarFolderTrigger from "./SidebarFolderTrigger.vue";
import SidebarItem from "./SidebarItem.vue";
import SidebarSeparator from "./SidebarSeparator.vue";

export const SidebarPageTree = createPageTreeRenderer({
  SidebarFolder,
  SidebarFolderContent,
  SidebarSeparator,
  SidebarFolderLink,
  SidebarFolderTrigger,
  SidebarItem,
});

export const SidebarLinkItem = createLinkItemRenderer({
  SidebarFolder,
  SidebarFolderContent,
  SidebarFolderLink,
  SidebarFolderTrigger,
  SidebarItem,
});
