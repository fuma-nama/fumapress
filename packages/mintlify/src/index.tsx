import { stripBase, type AppShape, type Plugin } from "@fumapress/core";
import type { LoaderPlugin } from "fumadocs-core/source";
import type { ReactNode } from "react";
import { MintlifyBannerBar } from "./features/banner";
import { MintlifyFooterBar } from "./features/footer";
import { buildRootHead } from "./features/head";
import { buildNavbarLinks, buildNavTitle } from "./features/navbar";
import { notFoundView, type MintlifyViews } from "./features/not-found";
import { createRedirectMatcher } from "./features/redirects";
import { getMintlifyLanguages, type I18nConfigExtended, type MintlifyI18nOptions } from "./i18n";
import { loadMintlifyIcons } from "./icons";
import {
  buildPageTreeFromNavigation,
  createPageIndex,
  getNavigablePages,
  normalizeMintPath,
} from "./navigation";
import { readMintlifyDocs, type ReadMintlifyDocsOptions } from "./read-config";
import type { MintlifyBanner, MintlifyDocsJson, MintlifyFooter } from "./schema";

/**
 * Feature toggles, everything is enabled by default. Disable a feature to
 * take manual control of it in `press.config.tsx`.
 */
export interface MintlifyFeatures {
  /** sidebar/page tree from `navigation` */
  navigation?: boolean;
  /** navbar links, primary CTA, site name & `logo` */
  navbar?: boolean;
  /** `colors`, `background`, `fonts`, `favicon`, `seo`, `description` and `integrations` (head tags) */
  theme?: boolean;
  /** `appearance` (default color scheme + strict mode) */
  appearance?: boolean;
  /** announcement `banner` */
  banner?: boolean;
  /** `footer` with socials & link columns */
  footer?: boolean;
  /** `redirects` middleware */
  redirects?: boolean;
  /** `errors.404` as the view at `/404` */
  notFound?: boolean;
  /** `search.prompt` */
  search?: boolean;
  /** `metadata.timestamp` (last-updated dates) */
  metadata?: boolean;
}

export interface MintlifyPluginOptions extends ReadMintlifyDocsOptions, MintlifyI18nOptions {
  /**
   * Docs collection folder name inside `content/`.
   * @default "docs"
   */
  docsDir?: string;

  /** Enable/disable individual docs.json features. */
  features?: MintlifyFeatures;
}

export function mintlifyPlugin<C extends AppShape = AppShape>(
  options: MintlifyPluginOptions = {},
): Plugin<C, { views: MintlifyViews }> {
  const { docsDir = "docs", features = {}, ...readOptions } = options;
  const enabled = (feature: keyof MintlifyFeatures) => features[feature] !== false;

  let docs: MintlifyDocsJson;
  /** for `seo.indexing: "navigable"` */
  let navigable: Set<string> | undefined;
  let redirect: ReturnType<typeof createRedirectMatcher> | undefined;

  function isNavigable(page: C["page"]): boolean {
    if (!navigable || page.slugs.length === 0) return true;

    for (const candidate of [page.url, page.path]) {
      const normalized = normalizeMintPath(candidate);
      if (navigable.has(normalized)) return true;

      // tolerate locale/version prefixes in the URL
      for (const path of navigable) {
        if (normalized.endsWith(`/${path}`)) return true;
      }
    }
    return false;
  }

  return {
    name: "fumapress:mintlify",
    init() {
      docs = readMintlifyDocs(readOptions);

      if (getMintlifyLanguages(docs).length > 0 && !this.i18nConfig) {
        console.warn(
          "[Fumapress Mintlify] docs.json defines navigation.languages but i18n is not configured. Use defineMintlifyI18n() in press.config.tsx",
        );
      }
      if (enabled("theme") && docs.seo?.indexing !== "all")
        navigable = getNavigablePages(docs.navigation);
      if (enabled("redirects") && docs.redirects?.length)
        redirect = createRedirectMatcher(docs.redirects);
    },
    async baseOptions() {
      if (!enabled("navbar")) return;
      const { title, url } = buildNavTitle(docs);
      const links = await buildNavbarLinks(docs);

      return {
        links,
        nav: { title, url },
        themeSwitch:
          enabled("appearance") && docs.appearance?.strict ? { enabled: false } : undefined,
      };
    },
    providerProps() {
      const appearance = enabled("appearance") ? docs.appearance : undefined;
      const prompt = enabled("search") ? docs.search?.prompt : undefined;

      return {
        theme: appearance && {
          defaultTheme: appearance.default,
          forcedTheme:
            appearance.strict && appearance.default !== "system" ? appearance.default : undefined,
        },
        i18n: prompt
          ? { translations: { "Search(search trigger)": prompt, "Search(search dialog)": prompt } }
          : undefined,
      };
    },
    views({ lang }) {
      if (!enabled("notFound")) return;
      const view = notFoundView(this, lang, docs.errors);
      if (view) return [view];
    },
    async configureLoader() {
      if (!enabled("navigation")) return;

      await loadMintlifyIcons(docs.navigation);
      const { _getMintlifyLanguage } = (this.i18nConfig ?? {}) as I18nConfigExtended;
      const navigation: LoaderPlugin = {
        name: "fumapress:mintlify",
        transformPageTree: {
          root(root) {
            const children = buildPageTreeFromNavigation(docs.navigation, createPageIndex(root), {
              language: this.locale && _getMintlifyLanguage?.(this.locale),
              docsDir,
            });

            if (children.length === 0) {
              console.warn(
                "[Fumapress Mintlify] No navigation entries matched existing pages; keeping default page tree",
              );
              return root;
            }
            return { ...root, name: docs.name, children };
          },
        },
      };
      return { plugins: [navigation] };
    },
    transformPage(data) {
      // Mintlify hides last-modified timestamps unless `metadata.timestamp` is enabled
      if (enabled("metadata") && docs.metadata?.timestamp !== true)
        return { ...data, lastModified: undefined };
      return data;
    },
    head({ page }) {
      if (!enabled("theme")) return;
      if (!page) return buildRootHead(docs);
      if (!isNavigable(page))
        return [{ tag: "meta", attrs: { name: "robots", content: "noindex" } }];
    },
    slots({ page }) {
      const banner = enabled("banner") ? docs.banner : undefined;
      const footer = enabled("footer") ? docs.footer : undefined;
      if (page || (!banner && !footer)) return;

      return [{ slot: "layout.wrapper", component: MintlifyFrame, props: { banner, footer } }];
    },
    async middleware(request, next) {
      const pathname = stripBase(new URL(request.url).pathname, this.withBase("/"));
      const result = pathname !== undefined ? redirect?.(pathname) : undefined;
      if (!result) return next();

      const { destination, permanent } = result;
      return new Response(null, {
        status: permanent ? 308 : 307,
        headers: {
          Location: URL.canParse(destination) ? destination : this.withBase(destination),
        },
      });
    },
  };
}

/** the banner above the layout of every page, the footer below it */
function MintlifyFrame({
  banner,
  footer,
  children,
}: {
  banner?: MintlifyBanner;
  footer?: MintlifyFooter;
  children: ReactNode;
}) {
  return (
    <>
      {banner && <MintlifyBannerBar banner={banner} />}
      {children}
      {footer && <MintlifyFooterBar footer={footer} />}
    </>
  );
}

export { defineMintlifyI18n, type MintlifyI18nOptions } from "./i18n";
export { readMintlifyDocs, type ReadMintlifyDocsOptions } from "./read-config";
export type { MintlifyDocsJson } from "./schema";
