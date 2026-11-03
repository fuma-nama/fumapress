import type { AstroGlobal } from "astro";
import { trailingSlash } from "astro:config/client";
import config from "virtual:fumapress/config";
import { adapter, mode as defaultMode, pages, prerender, siteUrl } from "virtual:fumapress/astro";
import {
  createPress,
  recommendedPreset,
  stripBase,
  type AppShape,
  type Context,
} from "@fumapress/core";
import { i18nProvider } from "fumadocs-ui/i18n";
import { contentSourcePlugin } from "./content-source";
import { expandViews } from "./routes/shared";
import type { ProviderData } from "./ui/content";
import type { SearchEngine } from "./ui/search";

const mode = config.mode ?? defaultMode;
if (mode !== "static" && !adapter)
  throw new Error(
    `[Fumapress] \`mode: "${mode}"\` renders routes on request, add an adapter to Astro or use \`mode: "static"\`.`,
  );

const ctx = await createPress(
  {
    ...config,
    mode,
    site: { ...config.site, baseUrl: config.site?.baseUrl ?? siteUrl },
    plugins: [contentSourcePlugin(), ...(config.plugins ?? [])],
  },
  {
    base: import.meta.env.BASE_URL,
    preset: recommendedPreset,
    getFrameworkPages: async (ctx) => [...pages, ...(await expandViews(ctx))],
    trailingSlash: trailingSlash === "always",
  },
);

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

const searchPlugin = ctx.getProvider("search");
const search: SearchEngine | undefined =
  searchPlugin && ((mode === "static" && searchPlugin.api?.staticIndex) || "fetch");
const base = ctx.withBase("/");

/** the language of a path by its prefix, like the URLs of pages */
function localeOf(path: string): string | undefined {
  const i18n = ctx.i18nConfig;
  if (!i18n) return;
  const prefix = path.split("/", 2)[1];
  return prefix && i18n.languages.includes(prefix) ? prefix : i18n.defaultLanguage;
}

/** the site, for your own pages and routes */
export function getPressContext<C extends AppShape = AppShape>(): Context<C> {
  return ctx as unknown as Context<C>;
}

/**
 * The props of providers on your own pages, like `<Content provider={getProviderData(Astro)} />`.
 *
 * @param lang - the language of the page, from its URL prefix by default
 */
export function getProviderData(
  astro: Pick<AstroGlobal, "url" | "params">,
  lang?: string,
): ProviderData {
  // like the URLs of pages, prerendering with `build.format: "file"` gives the path of the file
  const pathname =
    (stripBase(astro.url.pathname, base) ?? astro.url.pathname).replace(
      /(?:\/index\.html|\.html|(.)\/)$/,
      "$1",
    ) || "/";
  const translations = ctx.translationsConfig;

  return {
    pathname,
    params: astro.params,
    i18n:
      translations &&
      ("config" in translations
        ? i18nProvider(translations, lang ?? localeOf(pathname))
        : i18nProvider(translations)),
    search,
  };
}
