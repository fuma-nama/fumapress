import type { AppContext, AppShape, PressPlugin } from "fumapress";
import type { DocsLayoutContextData } from "fumapress/layouts/docs";
import type { MiddlewareHandler } from "hono";
import { getMintlifyLanguages, I18nConfigExtended, type MintlifyI18nOptions } from "./i18n";
import {
  buildPageTreeFromNavigation,
  createPageIndex,
  getNavigablePages,
  normalizeMintPath,
} from "./navigation";
import { readMintlifyDocs, type ReadMintlifyDocsOptions } from "./read-config";
import type { MintlifyDocsJson } from "./schema";
import { MintlifyBannerBar } from "./features/banner";
import { MintlifyFooterBar } from "./features/footer";
import { buildRootHead } from "./features/head";
import { buildNavbarLinks, buildNavTitle } from "./features/navbar";
import { createMintlifyNotFound } from "./features/not-found";
import { createRedirectMatcher } from "./features/redirects";

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
  /** `errors.404` handling */
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
): PressPlugin<C> {
  const { docsDir = "docs", features = {}, ...readOptions } = options;
  const enabled = (feature: keyof MintlifyFeatures) => features[feature] !== false;

  let docs: MintlifyDocsJson;

  function initNavigationTransformer(data: DocsLayoutContextData<C>, ctx: AppContext<C>) {
    const transformers = (data.transformers ??= []);

    transformers.push(async function ({ data: props, page }) {
      if (enabled("metadata") && docs.metadata?.timestamp !== true) {
        // Mintlify hides last-modified timestamps unless `metadata.timestamp` is enabled
        props.lastModified = null;
      }

      if (!enabled("navigation")) return props;

      const source = await ctx.getLoader();
      const root = source.getPageTree(page.locale);
      const pageIndex = createPageIndex(root);
      let mintlifyLanguage: string | undefined;

      if (page.locale && ctx.i18nConfig) {
        const { _getMintlifyLanguage } = ctx.i18nConfig as I18nConfigExtended;
        mintlifyLanguage = _getMintlifyLanguage?.(page.locale);
      }

      const children = await buildPageTreeFromNavigation(docs.navigation, pageIndex, {
        language: mintlifyLanguage,
        docsDir,
      });

      if (children.length === 0) {
        console.warn(
          "[Fumapress Mintlify] No navigation entries matched existing pages; keeping default page tree",
        );
        return props;
      }

      props.layoutProps.tree = { ...root, name: docs.name, children };
      return props;
    });
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

      // ---- head: colors, background, fonts, favicon, seo, integrations ----
      if (enabled("theme")) {
        const head = buildRootHead(docs);
        this.interceptRootMeta(({ next }) => (
          <>
            {next()}
            {head}
          </>
        ));

        // seo.indexing: noindex pages that are not part of the navigation
        if (docs.seo?.indexing !== "all") {
          const navigable = getNavigablePages(docs.navigation);

          this.interceptPageMeta(({ page, next }) => {
            const candidates = [page.url, (page as { path?: string }).path].filter(
              (value): value is string => typeof value === "string",
            );

            const isNavigable =
              page.slugs.length === 0 ||
              candidates.some((candidate) => {
                const normalized = normalizeMintPath(candidate);
                if (navigable.has(normalized)) return true;

                // tolerate locale/version prefixes in the URL
                for (const path of navigable) {
                  if (normalized.endsWith(`/${path}`)) return true;
                }
                return false;
              });

            return (
              <>
                {next()}
                {!isNavigable && <meta name="robots" content="noindex" />}
              </>
            );
          });
        }
      }

      // ---- navbar: links, primary CTA, logo & site name ----
      if (enabled("navbar")) {
        const { title, url } = buildNavTitle(docs);
        const previousDefaultProps = this.defaultLayoutProps;

        this.defaultLayoutProps = async (opts) => {
          const inherited = await previousDefaultProps(opts);
          const links = await buildNavbarLinks(docs);

          return {
            ...inherited,
            links: links.length > 0 ? [...links, ...(inherited?.links ?? [])] : inherited?.links,
            nav: {
              url,
              ...inherited?.nav,
              title,
            },
            ...(enabled("appearance") && docs.appearance?.strict
              ? { themeSwitch: { enabled: false, ...inherited?.themeSwitch } }
              : undefined),
          };
        };
      }

      const providerHooks = (this.data["core:provider"] ??= []);

      // ---- appearance ----
      if (enabled("appearance") && docs.appearance) {
        const appearance = docs.appearance;

        providerHooks.push((props) => {
          props.theme = {
            defaultTheme: appearance.default,
            forcedTheme:
              appearance.strict && appearance.default && appearance.default !== "system"
                ? appearance.default
                : undefined,
            ...props.theme,
          };
          return props;
        });
      }

      // ---- search.prompt ----
      if (enabled("search") && docs.search?.prompt) {
        const prompt = docs.search.prompt;

        providerHooks.push((props) => {
          props.i18n = {
            ...props.i18n,
            translations: {
              "Search(search trigger)": prompt,
              "Search(search dialog)": prompt,
              ...props.i18n?.translations,
            },
          };
          return props;
        });
      }

      // ---- banner & footer ----
      const banner = enabled("banner") && docs.banner;
      const footer = enabled("footer") && docs.footer;

      if (banner || footer) {
        providerHooks.push((props) => {
          props.children = (
            <>
              {banner && <MintlifyBannerBar banner={banner} />}
              {props.children}
              {footer && <MintlifyFooterBar footer={footer} />}
            </>
          );
          return props;
        });
      }

      // ---- errors.404 ----
      if (enabled("notFound")) {
        this.renderNotFound = createMintlifyNotFound(
          docs.errors,
          this.renderNotFound,
        ) as typeof this.renderNotFound;
      }

      if (enabled("navigation") || enabled("metadata")) {
        initNavigationTransformer((this.data["core:docs-layout"] ??= {}), this);
        initNavigationTransformer(
          (this.data["core:notebook-layout"] ??= {}) as DocsLayoutContextData<C>,
          this,
        );
      }
    },
    createMiddlewares() {
      if (!enabled("redirects")) return;

      const redirects = docs.redirects;
      if (!redirects?.length) return;

      const match = createRedirectMatcher(redirects);
      const middleware: MiddlewareHandler = async (c, next) => {
        const result = match(c.req.path);
        if (result) {
          return c.redirect(result.destination, result.permanent ? 308 : 307);
        }

        return next();
      };

      return [middleware];
    },
  };
}

export { defineMintlifyI18n, type MintlifyI18nOptions } from "./i18n";
export { readMintlifyDocs, type ReadMintlifyDocsOptions } from "./read-config";
export type { MintlifyDocsJson } from "./schema";
