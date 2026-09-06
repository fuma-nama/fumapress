import type * as PageTree from "fumadocs-core/page-tree";

/** folder path of the sidebar tree root (e.g. the `baseDir` of a content source), or a function selecting it per page */
export type TreeRoot<Page> = string | ((page: Page) => string);

export function selectTreeRoot<Page>(
  tree: PageTree.Root,
  treeRoot: TreeRoot<Page> | undefined,
  page: Page,
): PageTree.Root {
  if (treeRoot === undefined) return tree;
  const path = typeof treeRoot === "function" ? treeRoot(page) : treeRoot;
  const scoped = scope(tree, path);
  if (scoped) return scoped;

  const available: string[] = [];
  for (const folder of folders(tree.children)) {
    const folderPath = pathOf(folder);
    if (folderPath) available.push(folderPath);
  }

  throw new Error(
    `[Fumapress] folder "${path}" is not in the page tree, available folders: ${available.join(", ")}`,
  );
}

function scope(root: PageTree.Root, path: string): PageTree.Root | undefined {
  for (const folder of folders(root.children)) {
    if (pathOf(folder) !== path) continue;

    return {
      ...root,
      children: folder.index ? [folder.index, ...folder.children] : folder.children,
      fallback: root.fallback && scope(root.fallback, path),
    };
  }
}

function* folders(nodes: PageTree.Node[]): Generator<PageTree.Folder> {
  for (const node of nodes) {
    if (node.type !== "folder") continue;
    yield node;
    yield* folders(node.children);
  }
}

/** folder `$id` is its path, prefixed with the locale and `fallback` on fallback trees */
function pathOf(folder: PageTree.Folder): string | undefined {
  const id = folder.$id;
  return id?.slice(id.lastIndexOf(":") + 1);
}
