"use client";
import { preload, preloadModule, type PreloadModuleOptions, type PreloadOptions } from "react-dom";

/**
 * A `<link rel="preload">` or `<link rel="modulepreload">` of `head` with React prop names, through React's `preload()`
 * or `preloadModule()`. React emits the `<link>` once; a `<link>` rendered by a server component also sends a hint for
 * it, which adds a second copy. Called while rendering the page's HTML, where React takes the call (it drops it in a
 * server component after an `await`), and again on the client after a navigation.
 */
export function Preload({ rel, href, ...options }: { rel: string; href: string }) {
  if (rel === "modulepreload") preloadModule(href, options as PreloadModuleOptions);
  else preload(href, options as PreloadOptions);
  return null;
}
