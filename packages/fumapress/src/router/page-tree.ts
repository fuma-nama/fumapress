import { registerClientReference } from "@vitejs/plugin-rsc/rsc";
import { serializeRsc } from "waku/server";
import type * as PageTree from "fumadocs-core/page-tree";
import type { Context, Plugin } from "@fumapress/core";
import { getRootChildren } from "@fumapress/core/runtime";

const files = new WeakMap<PageTree.Root, Promise<string>>();

/**
 * A tree in the payload of every page makes the output of a site quadratic to its pages. Its node lists become client
 * references to a file wherever Flight meets them: the client gets them back like a client module (`client-entry.ts`),
 * the server still has the same arrays.
 */
async function createFile(ctx: Context, tree: PageTree.Root, lang: string | undefined) {
  /** the exports of the file: Flight writes a list in another list once */
  const lists: Record<string, PageTree.Node[]> = {};
  const references: [nodes: PageTree.Node[], name: string][] = [];

  function addList(nodes: PageTree.Node[], name: string) {
    const list: PageTree.Node[] = [];
    for (const [i, node] of nodes.entries()) {
      if (node.type !== "folder") {
        list.push(node);
        continue;
      }
      const children = addList(node.children, `${name}.${i}`);
      list.push({ ...node, children });
      if (node.index) {
        lists[`${name}.${i}+`] = [node.index, ...children];
        references.push([getRootChildren(node), `${name}.${i}+`]);
      }
    }
    lists[name] = list;
    references.push([nodes, name]);
    return list;
  }
  addList(tree.children, "c");
  if (tree.fallback) addList(tree.fallback.children, "f");

  const bytes = (await serializeRsc(lists)) as Uint8Array<ArrayBuffer>;
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  let hex = "";
  for (const byte of new Uint8Array(hash, 0, 8)) hex += byte.toString(16).padStart(2, "0");
  const file = `${lang ?? "default"}.${hex}.txt`;
  const url = ctx.withBase(`/_fumapress/page-tree/${file}`);

  (globalThis.PAGE_TREE_FILES ??= new Map()).set(url, bytes);
  for (const [nodes, name] of references) {
    if ("$$typeof" in nodes) continue;
    registerClientReference(nodes, `page-tree:${url}`, name);
    // changes wouldn't reach the client, they belong in `pageTree.transformers` of the loader
    Object.freeze(nodes);
  }
  return file;
}

/** the files of the trees of the loader, whose content can change while the server runs */
export async function getPageTreeFiles(ctx: Context): Promise<string[]> {
  const source = await ctx.getLoader();
  return Promise.all(
    ctx.languages.map((lang) => {
      const tree = source.getPageTree(lang);
      let file = files.get(tree);
      if (!file) files.set(tree, (file = createFile(ctx, tree, lang)));
      return file;
    }),
  );
}

export function pageTreePlugin(): Plugin {
  return {
    name: "waku:page-tree",
    async routes({ createApi }) {
      const path = "/_fumapress/page-tree/[file]";
      const GET = async (request: Request) => {
        await getPageTreeFiles(this);
        const bytes = globalThis.PAGE_TREE_FILES?.get(this.withBase(new URL(request.url).pathname));
        if (!bytes) return new Response(null, { status: 404 });
        return new Response(bytes, {
          headers: {
            "Content-Type": "text/x-component",
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      };

      createApi({ path, render: "static", staticPaths: await getPageTreeFiles(this), GET });
      // revalidated content has another URL
      if (this.mode === "default") createApi({ path, GET });
    },
  };
}
