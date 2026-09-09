import type * as PageTree from "fumadocs-core/page-tree";
import { expect, test } from "vitest";
import { selectTreeRoot } from "@/lib/page-tree";

function page(url: string): PageTree.Item {
  return { type: "page", name: url, url };
}

function folder(
  path: string,
  id: string,
  children: PageTree.Node[],
  index?: PageTree.Item,
): PageTree.Folder {
  return { type: "folder", $id: id, $ref: { folder: path }, name: path, children, index };
}

const guides = folder(
  "docs/guides",
  "en:docs/guides",
  [page("/docs/guides/a")],
  page("/docs/guides"),
);
const docs = folder("docs", "en:docs", [page("/docs"), guides]);
const fallbackDocs = folder("docs", "fallback:en:docs", [
  folder("docs/guides", "fallback:en:docs/guides", [page("/docs/guides/b")]),
]);
const tree: PageTree.Root = {
  name: "root",
  children: [docs, folder("blog", "en:blog", [page("/blog/hello")])],
  fallback: { name: "fallback", children: [fallbackDocs] },
};

test("keeps the tree without a root", () => {
  expect(selectTreeRoot(tree, undefined)).toBe(tree);
});

test("selects a top-level folder and scopes the fallback tree", () => {
  const result = selectTreeRoot(tree, "docs");

  expect(result.children).toBe(docs.children);
  expect(result.fallback?.children).toBe(fallbackDocs.children);
});

test("selects a nested folder and keeps its index page first", () => {
  const result = selectTreeRoot(tree, "docs/guides");

  expect(result.children).toEqual([guides.index, ...guides.children]);
  expect(result.fallback?.children).toEqual([page("/docs/guides/b")]);
});

test("drops the fallback tree when it lacks the folder", () => {
  expect(selectTreeRoot(tree, "blog").fallback).toBeUndefined();
});

test("throws on unknown paths with the available folders", () => {
  expect(() => selectTreeRoot(tree, "guides")).toThrow(
    'folder "guides" is not in the page tree, available folders: docs, docs/guides, blog',
  );
});
