import { trailingSlash } from "astro:config/client";
import config from "virtual:fumapress/config";
import { adapter, routes, prerender, serverOutput, siteUrl } from "virtual:fumapress/astro";
import { stripBase } from "@fumapress/core";
import { createPressContext, pathLocale } from "@fumapress/core/runtime";
import { contentSourcePlugin } from "../content-source";
import { pageTreePlugin } from "../island/page-tree";
import { getReference } from "../island/references";

// a reloaded `press.config.tsx` creates another context
const controller = new AbortController();
import.meta.hot?.dispose(() => controller.abort());

/** the context of the site, with the getters of the runtime */
export const ctx = await createPressContext(config, {
  base: import.meta.env.BASE_URL,
  baseUrl: siteUrl,
  trailingSlash: trailingSlash === "always",
  dynamic: serverOutput,
  defaults: [contentSourcePlugin(), pageTreePlugin(prerender)],
  signal: controller.signal,
  isClientReference: (value) => getReference(value) !== undefined,
});

if (!adapter && ctx.getContentRender() === "dynamic")
  throw new Error(
    "[Fumapress] a dynamic content source renders its pages on demand, add an adapter to Astro.",
  );

ctx.setRuntimeRoutes(
  routes.map(({ path: route, render }) => {
    // a segment of the URL on Astro, a route group in the paths of core: the encoded form is the same URL
    const path = route.replaceAll("/(", "/%28");
    const lang = pathLocale(ctx, path);
    const pathname = stripBase(path, ctx.localizePath(lang, "/"));
    return pathname === undefined ? { path, render } : { path: pathname, lang, render };
  }),
);

if (import.meta.env.DEV) {
  for (const plugin of ctx.plugins) {
    if ("waku" in plugin && plugin.waku)
      console.warn(
        `[Fumapress] ${plugin.name ?? "a plugin"} uses Waku's own APIs (\`waku\`), Astro doesn't run them.`,
      );
  }
}

if (prerender) {
  if (!ctx.plugins.some((plugin) => plugin.build)) {
    globalThis.FUMAPRESS_BUILD = undefined;
  } else if (globalThis.FUMAPRESS_BUILD) {
    globalThis.FUMAPRESS_BUILD.ctx = ctx;
  } else {
    // the integration creates it in the build process, other threads and runtimes have none
    throw new Error(
      "[Fumapress] the `build` of plugins, like link validation, runs on the pages prerendered by the default prerenderer of Astro: remove `experimental.parallelPrerender` and prerender with Node.",
    );
  }
}
