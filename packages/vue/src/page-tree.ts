import * as core from "fumadocs-core/page-tree";
import type { PageTree } from "./core/types";

export type Root = PageTree.Root;
export type Node = PageTree.Node;
export type Item = PageTree.Item;
export type Separator = PageTree.Separator;
export type Folder = PageTree.Folder;

/**
 * Search the path of a node in the tree matched by the matcher.
 *
 * @returns The path to the target node (from starting root), or null if the page doesn't exist
 */
export const findPath = core.findPath as (
  nodes: Node[],
  matcher: (node: Node) => boolean,
  options?: { includeSeparator?: boolean },
) => Node[] | null;

/**
 * Find the structural projection of `page` (under the root folder `from`) in `to`: the page at the same file path
 * relative to the root folder.
 */
export const findProjection = core.findProjection as (
  from: Folder,
  to: Folder,
  page: Item,
) => Item | undefined;
