"use client";
import { preload, preloadModule, type PreloadAs, type PreloadOptions } from "react-dom";

/**
 * A `<link rel="preload">` or `<link rel="modulepreload">` of `head`, through React's `preload()` or
 * `preloadModule()`. React emits the `<link>` once; a `<link>` rendered by a server component also sends a hint for
 * it, which adds a second copy. Called while rendering the page's HTML, where React takes the call (it drops it in a
 * server component after an `await`), and again on the client after a navigation.
 */
export function Preload({ attrs }: { attrs: Record<string, string> }) {
  const { rel, href, as } = attrs;
  if (!href) return null;
  const crossOrigin = attrs.crossorigin as PreloadOptions["crossOrigin"];

  if (rel === "modulepreload") {
    preloadModule(href, {
      as: as as "script",
      crossOrigin,
      integrity: attrs.integrity,
      nonce: attrs.nonce,
    });
  } else if (as) {
    preload(href, {
      as: as as PreloadAs,
      crossOrigin,
      integrity: attrs.integrity,
      type: attrs.type,
      fetchPriority: attrs.fetchpriority as PreloadOptions["fetchPriority"],
      referrerPolicy: attrs.referrerpolicy as PreloadOptions["referrerPolicy"],
      imageSrcSet: attrs.imagesrcset,
      imageSizes: attrs.imagesizes,
      media: attrs.media,
      nonce: attrs.nonce,
    });
  }
  return null;
}
