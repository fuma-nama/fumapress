import { findPath, type Folder, type Node, type Root } from "@fumapress/vue/page-tree";
import { normalizeUrl } from "../utils/url";

export interface BreadcrumbItem {
  name: string;
  url?: string;
}

export interface BreadcrumbOptions {
  /**
   * Include the root folders in the breadcrumb items array.
   *
   * @defaultValue false
   */
  includeRoot?:
    | boolean
    | {
        /**
         * Specify the url of root
         */
        url: string;
      };

  /**
   * Include the page itself in the breadcrumb items array
   *
   * @defaultValue false
   */
  includePage?: boolean;

  /**
   * Count separator as an item
   *
   * @defaultValue false
   */
  includeSeparator?: boolean;
}

export function getBreadcrumbItemsFromPath(
  tree: Root | Folder,
  path: Node[],
  options: BreadcrumbOptions,
): BreadcrumbItem[] {
  const { includePage = false, includeSeparator = false, includeRoot = false } = options;
  let items: BreadcrumbItem[] = [];
  for (let i = 0; i < path.length; i++) {
    const item = path[i]!;

    switch (item.type) {
      case "page":
        if (includePage)
          items.push({
            name: item.name,
            url: item.url,
          });
        break;
      case "folder":
        if (item.root) {
          items = [];
          if (includeRoot) {
            items.push({
              name: tree.name,
              url: typeof includeRoot === "object" ? includeRoot.url : item.index?.url,
            });
          }
          break;
        }

        // only show the index node of folders if possible
        if (i === path.length - 1 || item.index !== path[i + 1]) {
          items.push({
            name: item.name,
            url: item.index?.url,
          });
        }
        break;
      case "separator":
        if (item.name && includeSeparator)
          items.push({
            name: item.name,
          });
        break;
    }
  }

  return items;
}

/**
 * Search the path of a node in the tree by a specified url
 *
 * - When the page doesn't exist, return null
 *
 * @returns The path to the target node from root
 * @internal Don't use this on your own
 */
export function searchPath(nodes: Node[], url: string): Node[] | null {
  const normalizedUrl = normalizeUrl(url);

  return findPath(nodes, (node) => node.type === "page" && node.url === normalizedUrl);
}
