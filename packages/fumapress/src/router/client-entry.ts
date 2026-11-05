import { preload } from "react-dom";

declare global {
  var __vite_rsc_client_require__: (id: string) => unknown;
  /** the page tree files by URL, the SSR environment reads them in the process of the RSC environment */
  var PAGE_TREE_FILES: Map<string, Uint8Array<ArrayBuffer>> | undefined;
}

async function decode(url: string) {
  if (import.meta.env.SSR) {
    const { createFromReadableStream } = await import("@vitejs/plugin-rsc/ssr");
    return createFromReadableStream(new Response(globalThis.PAGE_TREE_FILES?.get(url)).body!);
  }

  const res = await fetch(url).catch(() => undefined);
  if (!res?.ok) {
    // like a failed client chunk, the recovery of Waku reloads the page
    window.dispatchEvent(new Event("vite:preloadError", { cancelable: true }));
    throw new Error(`[Fumapress] failed to fetch the page tree ${url}`);
  }

  const { createFromFetch } = await import("@vitejs/plugin-rsc/browser");
  return createFromFetch(Promise.resolve(res));
}

// Waku's router throws on its base path without the trailing slash, where hosts like Cloudflare redirect it
if (!import.meta.env.SSR && `${location.pathname}/` === import.meta.env.BASE_URL)
  history.replaceState(null, "", import.meta.env.BASE_URL + location.search + location.hash);

const modules = new Map<string, Promise<unknown>>();
const load = globalThis.__vite_rsc_client_require__;

/** page tree files are client modules of Flight, see `page-tree.ts` */
globalThis.__vite_rsc_client_require__ = (id) => {
  if (!id.startsWith("page-tree:")) return load(id);
  // development adds a cache tag
  const url = id.slice("page-tree:".length).split("$$cache=")[0]!;
  if (import.meta.env.SSR) preload(url, { as: "fetch", crossOrigin: "anonymous" });

  let module = modules.get(url);
  if (!module) modules.set(url, (module = decode(url)));
  return module;
};
