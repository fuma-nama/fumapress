import { registerClientReference } from "@vitejs/plugin-rsc/rsc";
import { serializeRsc } from "waku/server";
import type * as PageTree from "fumadocs-core/page-tree";
import type { Context, Plugin } from "@fumapress/core";
import { getRootChildren } from "@fumapress/core/page-tree";

const files = new WeakMap<PageTree.Root, Promise<string>>();
/** the file URLs of each language, oldest first: a render in flight while the content changes reads the one before the last */
const kept = new Map<string | undefined, Set<string>>();

/**
 * A tree in the payload of every page makes the output of a site quadratic to its pages. Its node lists become client
 * references to a file wherever Flight meets them: the client gets them back like a client module (`client-entry.ts`),
 * the server still has the same arrays.
 */
async function createFile(ctx: Context, tree: PageTree.Root, lang: string | undefined) {
  /** the exports of the file: serialized before they become references, Flight writes a list in another list once */
  const lists: Record<string, PageTree.Node[]> = {};

  function addList(nodes: PageTree.Node[], name: string) {
    for (const [i, node] of nodes.entries()) {
      if (node.type !== "folder") continue;
      addList(node.children, `${name}.${i}`);
      if (node.index) lists[`${name}.${i}+`] = getRootChildren(node);
    }
    lists[name] = nodes;
  }
  addList(tree.children, "c");
  if (tree.fallback) addList(tree.fallback.children, "f");

  const bytes = (await serializeRsc(lists)) as Uint8Array<ArrayBuffer>;
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  let hex = "";
  for (const byte of new Uint8Array(hash, 0, 8)) hex += byte.toString(16).padStart(2, "0");
  const file = `${lang ?? "default"}.${hex}.txt`;
  const url = ctx.withBase(`/_fumapress/page-tree/${file}`);

  const stored = (globalThis.PAGE_TREE_FILES ??= new Map());
  stored.set(url, bytes);
  let urls = kept.get(lang);
  if (!urls) kept.set(lang, (urls = new Set()));
  urls.delete(url);
  urls.add(url);
  if (urls.size > 2) {
    const [oldest] = urls;
    urls.delete(oldest!);
    stored.delete(oldest!);
  }

  for (const name in lists) {
    const nodes = lists[name]!;
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

      // prerendered pages keep the files of their build, public files aren't for the pages of dynamic sources
      const pages = (await this.getLoader()).getPages();
      if (pages.some((page) => this.getContentRender(page.type) === "static"))
        createApi({ path, render: "static", staticPaths: await getPageTreeFiles(this), GET });
      // revalidated content has another URL
      if (this.getContentRender() === "dynamic") createApi({ path, GET });
    },
  };
}
