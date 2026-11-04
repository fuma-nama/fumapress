import { trailingSlash } from "astro:config/client";
import config from "virtual:fumapress/config";
import { adapter, defaultMode, routes, prerender, siteUrl } from "virtual:fumapress/astro";
import type { Press } from "@fumapress/core";
import { createPressContext, pathLocale } from "@fumapress/core/runtime";
import { uiTranslations } from "fumadocs-ui/i18n";
import { contentSourcePlugin } from "../content-source";
import { getReference } from "../island/references";

const input = config["~press"];
const mode = input.config.mode ?? defaultMode;
if (mode !== "static" && !adapter)
  throw new Error(
    `[Fumapress] \`mode: "${mode}"\` renders routes on request, add an adapter to Astro or use \`mode: "static"\`.`,
  );

/** the site of `press.config.tsx`, with the mode and URL of the Astro config */
const press: Press = {
  ...config,
  "~press": {
    ...input,
    config: {
      ...input.config,
      mode,
      site: { ...input.config.site, baseUrl: input.config.site?.baseUrl ?? siteUrl },
    },
  },
};

// a reloaded `press.config.tsx` creates another context
const controller = new AbortController();
import.meta.hot?.dispose(() => controller.abort());

/** the context of the site, with the getters of the runtime */
export const ctx = await createPressContext(press, {
  base: import.meta.env.BASE_URL,
  trailingSlash: trailingSlash === "always",
  defaults: [
    contentSourcePlugin(),
    { name: "astro:ui-translations", translations: uiTranslations() },
  ],
  signal: controller.signal,
  isClientReference: (value) => getReference(value) !== undefined,
});

ctx.setRuntimeRoutes(
  routes.map(({ path, render, pages }) => ({
    route: {
      path,
      lang: pathLocale(ctx, path),
      render,
      pages: pages.map((page) => ({ path: page, translations: [], params: {} })),
      options: {},
    },
  })),
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
  } else if (mode === "dynamic") {
    throw new Error(
      '[Fumapress] the `build` of plugins, like link validation, reads the prerendered pages, but pages render on request in `mode: "dynamic"`.',
    );
  } else if (globalThis.FUMAPRESS_BUILD) {
    globalThis.FUMAPRESS_BUILD.ctx = ctx;
  } else {
    // the integration creates it in the build process, other threads and runtimes have none
    throw new Error(
      "[Fumapress] the `build` of plugins, like link validation, runs on the pages prerendered by the default prerenderer of Astro: remove `experimental.parallelPrerender` and prerender with Node.",
    );
  }
}
