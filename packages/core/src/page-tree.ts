import type * as PageTree from "fumadocs-core/page-tree";

/** the page tree of the folder at `path`, like the `baseDir` of a collection; throws with the available folders when it is not in `tree` */
export function selectTreeRoot(tree: PageTree.Root, path: string): PageTree.Root {
  const scoped = scope(tree, path);
  if (scoped) return scoped;

  const available: string[] = [];
  for (const folder of folders(tree.children)) {
    if (folder.$ref) available.push(folder.$ref.folder);
  }

  throw new Error(
    `[Fumapress] folder "${path}" is not in the page tree, available folders: ${available.join(", ")}`,
  );
}

function scope(root: PageTree.Root, path: string): PageTree.Root | undefined {
  for (const folder of folders(root.children)) {
    // unlike `$id`, `$ref` is not prefixed on localized and fallback trees
    if (folder.$ref?.folder !== path) continue;

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
