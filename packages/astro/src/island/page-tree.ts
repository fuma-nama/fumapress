import type { Plugin } from "@fumapress/core";
import { deserializePageTree } from "fumadocs-core/source/client";
import { modules, registerPageTree } from "./references";

/**
 * A tree in the props of every page makes the output of a site quadratic to its pages. The trees of the loader are client references to a file instead: the island gets them by identity, the browser fetches each once.
 */
export function pageTreePlugin(): Plugin {
  const files = new Map<string | undefined, string>();

  return {
    name: "astro:page-tree",
    async routes({ createApi }) {
      const source = await this.getLoader();
      for (const lang of this.languages) {
        const tree = source.getPageTree(lang);
        const serialized = await source.serializePageTree(tree);
        const json = JSON.stringify(serialized);
        const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(json));
        let hex = "";
        for (const byte of new Uint8Array(hash, 0, 8)) hex += byte.toString(16).padStart(2, "0");
        // by the hash of its content: revalidated content has another URL
        const path = `/_fumapress/page-tree/${lang ?? "default"}.${hex}.json`;
        const url = this.withBase(path);
        const previous = files.get(lang);
        if (previous && previous !== url) modules.delete(previous);
        files.set(lang, url);
        registerPageTree(tree, url, deserializePageTree(serialized));
        createApi({
          path,
          render: "static",
          GET: () =>
            new Response(json, {
              headers: {
                "Content-Type": "application/json",
                "Cache-Control": "public, max-age=31536000, immutable",
              },
            }),
        });
      }
    },
  };
}
