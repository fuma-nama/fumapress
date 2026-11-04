import { serializeRsc } from "waku/server";
import type * as PageTree from "fumadocs-core/page-tree";
import { selectTreeRoot, stripBase, type Context } from "@fumapress/core";
import { setTreeSelector } from "@fumapress/core/runtime";
import { pageTreeChildren, type PageTreeReference } from "@/components/page-tree";

const PREFIX = "/_fumapress/page-tree";
const pathPattern = new RegExp(`^${PREFIX}/([^/]+)/\\w+/(?:(.+)/)?tree\\.txt$`);

/**
 * The page trees as files. A tree in the RSC payload of every page makes the output of a site quadratic to its pages, so
 * `ui.renderPage` receives a reference: the tree on the server, its `children` are replaced by a stub in the RSC payload.
 * The browser fetches the file once, as React Flight to keep the React nodes of the tree.
 */
export function createPageTreeFiles(ctx: Context) {
  const references = new WeakMap<PageTree.Root, Promise<PageTree.Root>>();
  /** the files for the build output by path, without the base path */
  const files = new Map<string, Promise<Uint8Array<ArrayBuffer>>>();

  function serialize(tree: PageTree.Root) {
    return serializeRsc(tree) as Promise<Uint8Array<ArrayBuffer>>;
  }

  /** the tree on the server, Flight serializes `children` as a client reference by these properties */
  function createReference(tree: PageTree.Root, path: string): PageTreeReference {
    const { $$typeof, $$id, $$async } = pageTreeChildren as PageTree.Node[] &
      Record<`$$${string}`, unknown>;
    const children = Object.defineProperties([...tree.children], {
      $$typeof: { value: $$typeof },
      $$id: { value: $$id },
      $$async: { value: $$async },
    });
    const reference: PageTreeReference = {
      ...tree,
      children,
      $file: encodeURI(ctx.withBase(path)),
    };
    // it comes from the file, and only the server reads it here
    return Object.defineProperty(reference, "fallback", { enumerable: false });
  }

  async function createRootReference(tree: PageTree.Root, lang: string | undefined) {
    const bytes = serialize(tree);
    const hash = await crypto.subtle.digest("SHA-256", await bytes);
    let hex = "";
    for (const byte of new Uint8Array(hash, 0, 8)) hex += byte.toString(16).padStart(2, "0");
    const dir = `${PREFIX}/${lang ?? "default"}/${hex}`;

    function register(tree: PageTree.Root, path: string, bytes: Promise<Uint8Array<ArrayBuffer>>) {
      const reference = createReference(tree, path);
      files.set(path, bytes);
      (global.PAGE_TREE_FILES ??= new Map()).set(reference.$file, bytes);
      return reference;
    }

    const selected = new Map<string, PageTreeReference>();
    const reference = register(tree, `${dir}/tree.txt`, bytes);
    setTreeSelector(reference, (folder) => {
      let out = selected.get(folder);
      if (!out) {
        const scoped = selectTreeRoot(tree, folder);
        out = register(scoped, `${dir}/${folder}/tree.txt`, serialize(scoped));
        selected.set(folder, out);
      }
      return out;
    });
    return reference;
  }

  return {
    /** the reference of a tree of the loader */
    getTree(tree: PageTree.Root, lang: string | undefined): Promise<PageTree.Root> {
      let reference = references.get(tree);
      if (!reference) {
        reference = createRootReference(tree, lang);
        references.set(tree, reference);
      }
      return reference;
    },
    /** rendered on request, also by an instance of the server that didn't render the page */
    async handleRequest(request: Request): Promise<Response | undefined> {
      if (request.method !== "GET") return;
      const pathname = stripBase(new URL(request.url).pathname, ctx.withBase("/"));
      const match = pathname && pathPattern.exec(decodeURI(pathname));
      if (!match) return;

      const lang = match[1] === "default" ? undefined : match[1];
      if (lang && !ctx.i18nConfig?.languages.includes(lang)) return;
      let tree = (await ctx.getLoader()).getPageTree(lang);
      try {
        if (match[2]) tree = selectTreeRoot(tree, match[2]);
      } catch {
        return new Response(null, { status: 404 });
      }
      return new Response(await serialize(tree), {
        headers: {
          "Content-Type": "text/x-component",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    },
    /** the files of the pages rendered so far */
    getFiles: () => files.entries(),
  };
}
