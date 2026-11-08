import { createFromFetch } from "@vitejs/plugin-rsc/browser";
import { loadPageTrees } from "./client-entry";

// Waku's router throws on its base path without the trailing slash, where hosts like Cloudflare redirect it
if (`${location.pathname}/` === import.meta.env.BASE_URL)
  history.replaceState(null, "", import.meta.env.BASE_URL + location.search + location.hash);

loadPageTrees(async (url) => {
  const res = await fetch(url).catch(() => undefined);
  if (!res?.ok) {
    // like a failed client chunk, the recovery of Waku reloads the page
    window.dispatchEvent(new Event("vite:preloadError", { cancelable: true }));
    throw new Error(`[Fumapress] failed to fetch the page tree ${url}`);
  }

  return createFromFetch(Promise.resolve(res));
});
