import type { AppContext, ConfigContext, ServerPlugin } from "fumapress";
import type { DocsLayoutContextData } from "fumapress/layouts/docs";
import type { LinkItemType } from "fumadocs-ui/layouts/shared";
import type { MiddlewareHandler } from "hono";
import {
  applyMintlifyTranslations,
  getMintlifyLanguages,
  pressLocaleToMintlify,
  type MintlifyI18nOptions,
} from "./i18n";
import { buildPageTreeFromNavigation, createPageIndex } from "./navigation";
import { readMintlifyDocs, type ReadMintlifyDocsOptions } from "./read-config";
import type { MintlifyDocsJson, MintlifyNavbarLink } from "./schema";

export interface MintlifyPluginOptions extends ReadMintlifyDocsOptions, MintlifyI18nOptions {
  /**
   * Docs collection folder name inside `content/`.
   * @default "docs"
   */
  docsDir?: string;
  /**
   * Apply Mintlify navbar links and site name to the docs layout.
   * @default true
   */
  applyNavbar?: boolean;
  /**
   * Apply Mintlify redirects as middleware.
   * @default true
   */
  applyRedirects?: boolean;
  /**
   * Extend configured translations with Mintlify language display names.
   * @default true
   */
  applyTranslations?: boolean;
}

function navbarLinkLabel(link: MintlifyNavbarLink): string {
  if (link.label) return link.label;
  if (link.type === "github") return "GitHub";
  if (link.type === "discord") return "Discord";
  return link.href;
}

function navbarLinks(docs: MintlifyDocsJson): LinkItemType[] {
  const links: LinkItemType[] = [];

  if (docs.navbar?.links) {
    for (const link of docs.navbar.links) {
      links.push({
        text: navbarLinkLabel(link),
        url: link.href,
        external: /^https?:\/\//.test(link.href),
      });
    }
  }

  const primary = docs.navbar?.primary;
  if (primary) {
    links.push({
      text: navbarLinkLabel(primary),
      url: primary.href,
      external: /^https?:\/\//.test(primary.href),
    });
  }

  return links;
}

export function mintlifyPlugin<C extends ConfigContext = ConfigContext>(
  options: MintlifyPluginOptions = {},
): ServerPlugin<C> {
  const {
    applyNavbar = true,
    applyRedirects = true,
    applyTranslations = true,
    docsDir = "docs",
    ...readOptions
  } = options;

  let docs: MintlifyDocsJson;

  function initNavigationRenderer(data: DocsLayoutContextData, ctx: AppContext<C>) {
    const renderers = (data.renderers ??= []);

    renderers.push(async function (props) {
      const source = await ctx.getLoader();
      const root = source.getPageTree(this.page.locale);
      const pageIndex = createPageIndex(root);
      const mintlifyLanguage = pressLocaleToMintlify(this.page.locale ?? "", docs, options);

      const children = buildPageTreeFromNavigation(docs.navigation, pageIndex, {
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

      if (applyTranslations) {
        applyMintlifyTranslations(this, docs, options);
      }

      if (getMintlifyLanguages(docs).length > 0 && !this.i18nConfig) {
        console.warn(
          "[Fumapress Mintlify] docs.json defines navigation.languages but i18n is not configured. Use mintlifyI18n(docs) in press.config.tsx",
        );
      }

      if (applyNavbar) {
        const links = navbarLinks(docs);
        const previousDefaultProps = this.layouts.defaultProps;

        this.layouts.defaultProps = async function (env) {
          const inherited = await previousDefaultProps?.call(this, env);

          return {
            ...inherited,
            links: links.length > 0 ? [...links, ...(inherited?.links ?? [])] : inherited?.links,
            nav: {
              ...inherited?.nav,
              title: docs.name,
            },
          };
        };
      }

      initNavigationRenderer((this.data["core:docs-layout"] ??= {}), this);
      initNavigationRenderer((this.data["core:notebook-layout"] ??= {}) as never, this);
    },
    createMiddlewares() {
      if (!applyRedirects) return;

      const redirects = docs.redirects;
      if (!redirects?.length) return;

      const middleware: MiddlewareHandler = async (c, next) => {
        const pathname = c.req.path;

        for (const redirect of redirects) {
          if (pathname !== redirect.source && pathname !== `${redirect.source}/`) continue;
          return c.redirect(redirect.destination, redirect.permanent === false ? 307 : 308);
        }

        return next();
      };

      return [middleware];
    },
  };
}
