import { preload } from "react-dom";

declare global {
  var __vite_rsc_client_require__: (id: string) => unknown;
  /** the page tree files by URL, the SSR environment reads them in the process of the RSC environment */
  var PAGE_TREE_FILES: Map<string, Uint8Array<ArrayBuffer>> | undefined;
}

/**
 * page tree files are client modules of Flight, see `page-tree.ts`. Flight loads client modules through this global and
 * `@vitejs/plugin-rsc` has no API to add one; if it renames the global, every page fails in dev and CI.
 *
 * Each environment has its own entry with `decode`, so neither imports the Flight client of the other.
 */
export function loadPageTrees(decode: (url: string) => Promise<unknown>) {
  const modules = new Map<string, Promise<unknown>>();
  const load = globalThis.__vite_rsc_client_require__;

  globalThis.__vite_rsc_client_require__ = (id) => {
    if (!id.startsWith("page-tree:")) return load(id);
    // development adds a cache tag
    const url = id.slice("page-tree:".length).split("$$cache=")[0]!;
    if (import.meta.env.SSR) preload(url, { as: "fetch", crossOrigin: "anonymous" });

    let module = modules.get(url);
    if (!module) {
      // the server drops the files of old content
      if (import.meta.env.SSR)
        for (const key of modules.keys())
          if (!globalThis.PAGE_TREE_FILES?.has(key)) modules.delete(key);
      modules.set(url, (module = decode(url)));
    }
    return module;
  };
}
