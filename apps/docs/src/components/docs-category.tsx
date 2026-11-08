"use client";
import { useTreePath } from "fumadocs-ui/contexts/tree";
import { Card, Cards } from "fumadocs-ui/components/card";

/** the pages of the current page's folder */
export function DocsCategory() {
  const path = useTreePath();
  const folder = path.findLast((node) => node.type === "folder");
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
