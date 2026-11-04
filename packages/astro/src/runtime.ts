import type { AstroGlobal } from "astro";
import { trailingSlash } from "astro:config/client";
import config from "virtual:fumapress/config";
import { adapter, defaultMode, routes, prerender, siteUrl } from "virtual:fumapress/astro";
import { stripBase, type Press, type PressContext } from "@fumapress/core";
import { createPressContext, pathLocale } from "@fumapress/core/runtime";
import { siteI18n } from "@fumapress/core/runtime/ui";
import { uiTranslations } from "fumadocs-ui/i18n";
import { contentSourcePlugin } from "./content-source";
import { getReference } from "./island/references";
import type { ProviderData } from "./ui/content";

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

const ctx = await createPressContext(press, {
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

const base = ctx.withBase("/");

/** the site, for your own pages and routes: `getPressContext<typeof app>()` */
export function getPressContext<A extends Press<any, any> = Press>(): PressContext<A> {
  return ctx as unknown as PressContext<A>;
}

/**
 * The props of providers on your own pages, like `<Content provider={getProviderData(Astro)} />`.
 *
 * @param lang - the language of the page, from its URL prefix by default
 */
export function getProviderData<A extends Press<any, any> = Press>(
  astro: Pick<AstroGlobal, "url" | "params">,
  lang?: NonNullable<A["~types"]>["content"]["lang"],
): ProviderData {
  // like the URLs of pages, prerendering with `build.format: "file"` gives the path of the file
  const pathname =
    (stripBase(astro.url.pathname, base) ?? astro.url.pathname).replace(
      /(?:\/index\.html|\.html|(.)\/)$/,
      "$1",
    ) || "/";
  return {
    pathname,
    params: astro.params,
    i18n: siteI18n(ctx, { lang: lang ?? pathLocale(ctx, pathname) }),
  };
}
