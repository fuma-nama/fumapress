"use client";
import { useTreePath } from "fumadocs-ui/contexts/tree";
import { Card, Cards } from "fumadocs-ui/components/card";
import type * as PageTree from "fumadocs-core/page-tree";

/** the pages of the current page's folder */
export function DocsCategory() {
  const path = useTreePath();
  let folder: PageTree.Folder | undefined;
  for (let i = path.length - 1; i >= 0 && !folder; i--) {
    const node = path[i]!;
    if (node.type === "folder") folder = node;
  }
  if (!folder) return null;

  return (
    <Cards>
      {folder.children.map((item) =>
        item.type === "page" ? (
          <Card key={item.url} href={item.url} title={item.name}>
            {item.description}
          </Card>
        ) : null,
      )}
    </Cards>
  );
}
