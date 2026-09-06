import type * as PageTree from "fumadocs-core/page-tree";
import { expect, test } from "vitest";
import { selectTreeRoot } from "@/lib/page-tree";

function page(url: string): PageTree.Item {
  return { type: "page", name: url, url };
}

function folder(id: string, children: PageTree.Node[], index?: PageTree.Item): PageTree.Folder {
  return { type: "folder", $id: id, name: id, children, index };
}

const guides = folder("en:docs/guides", [page("/docs/guides/a")], page("/docs/guides"));
const docs = folder("en:docs", [page("/docs"), guides]);
const fallbackDocs = folder("fallback:en:docs", [
  folder("fallback:en:docs/guides", [page("/docs/guides/b")]),
]);
const tree: PageTree.Root = {
  name: "root",
  children: [docs, folder("en:blog", [page("/blog/hello")])],
  fallback: { name: "fallback", children: [fallbackDocs] },
};

test("keeps the tree without a root", () => {
  expect(selectTreeRoot(tree, undefined, undefined)).toBe(tree);
});

test("selects a top-level folder and scopes the fallback tree", () => {
  const result = selectTreeRoot(tree, "docs", undefined);

  expect(result.children).toBe(docs.children);
  expect(result.fallback?.children).toBe(fallbackDocs.children);
});

test("selects a nested folder and keeps its index page first", () => {
  const result = selectTreeRoot(tree, "docs/guides", undefined);

  expect(result.children).toEqual([guides.index, ...guides.children]);
  expect(result.fallback?.children).toEqual([page("/docs/guides/b")]);
});

test("drops the fallback tree when it lacks the folder", () => {
  expect(selectTreeRoot(tree, "blog", undefined).fallback).toBeUndefined();
});

test("selects the root per page", () => {
  const result = selectTreeRoot(tree, (page) => page.type, { type: "blog" });

  expect(result.children).toEqual([page("/blog/hello")]);
});

test("throws on unknown paths with the available folders", () => {
  expect(() => selectTreeRoot(tree, "guides", undefined)).toThrow(
    'folder "guides" is not in the page tree, available folders: docs, docs/guides, blog',
  );
});
