import { stripBase, type AppShape, type Plugin, type SlotItem } from "@fumapress/core";
import type { LoaderPlugin } from "fumadocs-core/source";
import type { ReactNode } from "react";
import { MintlifyBannerBar } from "./features/banner";
import { MintlifyFooterBar } from "./features/footer";
import { buildRootHead } from "./features/head";
import { buildNavbarLinks, buildNavTitle } from "./features/navbar";
import { notFoundView, type MintlifyViews } from "./features/not-found";
import { createRedirectMatcher } from "./features/redirects";
import { getMintlifyLanguages, mintlifyLanguageOf, type MintlifyI18nOptions } from "./i18n";
import { loadMintlifyIcons } from "./icons";
import {
  buildPageTreeFromNavigation,
  createPageIndex,
  getNavigablePages,
  normalizeMintPath,
} from "./navigation";
import { readMintlifyDocs, type ReadMintlifyDocsOptions } from "./read-config";
import type { MintlifyDocsJson, MintlifyFooter } from "./schema";

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

/** the views and slot items of `mintlifyPlugin()` */
export type MintlifyTypes = {
  views: MintlifyViews;
  slots: "mintlify:banner" | "mintlify:footer";
};

export function mintlifyPlugin<C extends AppShape = AppShape>(
  options: MintlifyPluginOptions = {},
): Plugin<C, MintlifyTypes> {
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
    async layoutProps() {
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
    routes({ createView }) {
      if (!enabled("notFound")) return;
      const view = notFoundView(this, docs.errors);
      if (view) createView(view);
    },
    async configureLoader() {
      if (!enabled("navigation")) return;

      await loadMintlifyIcons(docs.navigation);
      const i18n = this.i18nConfig;
      const navigation: LoaderPlugin = {
        name: "fumapress:mintlify",
        transformPageTree: {
          root(root) {
            const children = buildPageTreeFromNavigation(docs.navigation, createPageIndex(root), {
              language: mintlifyLanguageOf(i18n, this.locale),
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
    transformPage() {
      // Mintlify hides last-modified timestamps unless `metadata.timestamp` is enabled
      if (enabled("metadata") && docs.metadata?.timestamp !== true)
        return { lastModified: undefined };
    },
    head({ page }) {
      if (!enabled("theme")) return;
      if (!page) return buildRootHead(docs);
      if (!isNavigable(page))
        return [{ tag: "meta", attrs: { name: "robots", content: "noindex" } }];
    },
    slots({ lang, page }) {
      if (page) return;
      const language = mintlifyLanguageOf(this.i18nConfig, lang);
      const banner = enabled("banner")
        ? (getMintlifyLanguages(docs).find((entry) => entry.language === language)?.banner ??
          docs.banner)
        : undefined;
      const footer = enabled("footer") ? docs.footer : undefined;
      const items: SlotItem<MintlifyTypes>[] = [];
      if (banner)
        items.push({
          name: "mintlify:banner",
          region: "banner",
          component: MintlifyBannerBar,
          props: { banner },
        });
      if (footer)
        items.push({
          name: "mintlify:footer",
          region: "layout-wrapper",
          component: MintlifyFooterFrame,
          props: { footer },
        });
      return items;
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

/** the footer below the layout of every page */
function MintlifyFooterFrame({
  footer,
  children,
}: {
  footer: MintlifyFooter;
  children: ReactNode;
}) {
  return (
    <>
      {children}
      <MintlifyFooterBar footer={footer} />
    </>
  );
}

export { defineMintlifyI18n, type MintlifyI18nOptions } from "./i18n";
export { readMintlifyDocs, type ReadMintlifyDocsOptions } from "./read-config";
export type { MintlifyDocsJson } from "./schema";
