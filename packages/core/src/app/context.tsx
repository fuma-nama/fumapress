import type { FumapressConfig, BuildMode, ConfigUtils } from "@/config";
import { getGitRootDir } from "../lib/fs";
import {
  defaultGitProviderUrls,
  getFileUrl,
  getRepoLinkItem,
  getRepoUrl,
  type GitInfo,
} from "../lib/git";
import path from "node:path";
import type { Meta, Page, LoaderOutput } from "fumadocs-core/source";
import type { Awaitable, Adapter, PressLoaderOptions } from "../lib/types";
import { isValidElement, type ReactNode } from "react";
import createDeepmerge from "@fastify/deepmerge";
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { AsyncLocalStorage } from "node:async_hooks";
import { dynamicLoader } from "fumadocs-core/source/dynamic";
import type { I18nConfig, SingularTranslationsAPI, TranslationsAPI } from "fumadocs-core/i18n";
import { preinitPlugins, type PressPlugin } from "./plugin";
import { localizePath } from "@/lib/i18n";
import type { TOCItemType } from "fumadocs-core/toc";
import type { DocsLayoutContextData } from "@/layouts/docs";
import type { GlassLayoutContextData } from "@/layouts/glass";
import type { HomeLayoutContextData } from "@/layouts/home";
import type { NotebookLayoutContextData } from "@/layouts/notebook";
import type { RootLayoutContextData } from "@/layouts/root";
import type { TakumiContextData } from "@/plugins/takumi";

export interface AppShape {
  page: Page;
  meta: Meta;
  lang: string | undefined;
  /** source names in multi-source setup */
  source: string | undefined;
}

export interface AppContext<S extends AppShape = AppShape>
  extends FumapressLoader<S>, FumapressHooks<S> {
  mode: BuildMode;
  plugins: PressPlugin<S>[];
  adapters: Adapter<S>[];

  /** always `undefined`, easier way to infer types */
  $context: S;

  /**
   * custom data in app context, can be referenced from plugins/pages etc
   */
  data: AppContextData<S> & Record<string | symbol, unknown>;
  defaultLayoutProps: (opts: {
    lang: string | undefined;
  }) => Awaitable<Omit<BaseLayoutProps, "children">>;
  renderPage: (opts: { slugs: string[]; lang?: string; page: S["page"] }) => ReactNode;
  renderRoot: (opts: { lang?: string; children: ReactNode }) => ReactNode;
  renderNotFound: (opts: { lang?: string }) => ReactNode;
  /** prefix `pathname` with the language segment, unless `i18n.hideLocale` hides it */
  localizePath: (lang: string | undefined, pathname: string) => string;

  translationsConfig?:
    | ([S["lang"]] extends [string] ? TranslationsAPI<S["lang"]> : never)
    | SingularTranslationsAPI;
  i18nConfig?: [S["lang"]] extends [string] ? I18nConfig<S["lang"]> : undefined;
  siteConfig: {
    name: string;
    baseUrl?: string;
    trailingSlash?: boolean;
    hreflang?: Record<string, string>;
    git?: GitInfo & {
      rootDir: string;
    };
  };
}

export interface PageAlternate {
  locale: string;
  /** from `site.hreflang`, defaults to the locale code */
  hreflang: string;
  href: string;
}

type RootMetaInterceptor = (opts: { next: () => ReactNode }) => ReactNode;
type PageMetaInterceptor<C extends AppShape> = (opts: {
  page: C["page"];
  next: () => ReactNode;
}) => ReactNode;

/** can extend from plugins during `init()` */
export interface FumapressHooks<C extends AppShape> {
  interceptRootMeta: (interceptor: RootMetaInterceptor) => void;
  interceptPageMeta: (interceptor: PageMetaInterceptor<C>) => void;
  renderRootMeta: () => ReactNode;
  renderPageMeta: (page: C["page"]) => ReactNode;
  getPageToc: (page: C["page"]) => Awaitable<TOCItemType[] | undefined>;
  getPageBody: (page: C["page"]) => Awaitable<
    | {
        node: ReactNode;
      }
    | undefined
  >;
  getPageCreatedAt: (page: C["page"]) => Awaitable<Date | undefined>;
  getPageLastModified: (page: C["page"]) => Awaitable<Date | undefined>;

  /** URL of a file on the configured git provider, requires `site.git` to be configured */
  getFileUrl: (absolutePath: string) => Awaitable<string | undefined>;

  /**
   * Whether the page is inherited from the [fallback language](https://fumadocs.dev/docs/headless/internationalization/config#fallback-language) instead of being translated.
   */
  isFallbackPage: (page: C["page"]) => boolean;

  /** translations of the page (fallback pages excluded) for `hreflang` links, empty when it has none */
  getPageAlternates: (page: C["page"]) => Promise<PageAlternate[]>;

  /**
   * Absolute URL of a pathname with `site.baseUrl`, the pathname itself when unset.
   *
   * The `site.trailingSlash` policy applies to page URLs, pass `file: true` for files like images and feeds.
   */
  absoluteUrl: (pathname: string, options?: { file?: boolean }) => string;
}

export interface FumapressLoader<C extends AppShape = AppShape> {
  getLoader: () => Awaitable<
    LoaderOutput<{
      i18n: [C["lang"]] extends [string] ? I18nConfig<C["lang"]> : undefined;
      meta: C["meta"];
      page: C["page"];
    }>
  >;
  /** revalidate [dynamic content sources](https://fumadocs.dev/docs/headless/source-api/source#dynamic-source) */
  revalidateLoader:
    | (() => Promise<void>)
    | (C["source"] extends string ? (name: C["source"]) => Promise<void> : never);

  /** invalidate [dynamic content sources](https://fumadocs.dev/docs/headless/source-api/source#dynamic-source) */
  invalidateLoader:
    | (() => void)
    | (C["source"] extends string ? (name: C["source"]) => void : never);
}

export const appContext = new AsyncLocalStorage({
  name: "fumapress:core",
});

export function getPressContext<C extends AppShape = AppShape>(): AppContext<C> {
  const store = appContext.getStore();

  if (!store)
    throw new Error(
      "[Fumapress] Missing server context for Fumapress, make sure to use the middlewares from createRouter()",
    );

  return store as AppContext<C>;
}

export async function initApp<C extends AppShape>(builder: ConfigUtils): Promise<AppContext<C>> {
  const config = builder.get();
  const {
    translations,
    site,
    defaultLayoutProps,
    mode = "default",
    renderNotFound = (await import("fumadocs-ui/layouts/home/not-found")).DefaultNotFound,
    renderPage = (await import("@/layouts/docs")).createDocsLayoutPage(),
    renderRoot = (await import("@/layouts/root")).createRootLayout(),
  } = config;
  const i18nConfig =
    translations && "config" in translations
      ? (translations.config as AppContext["i18nConfig"])
      : config.i18n;

  const ctx: AppContext = {
    $context: undefined as never,
    getLoader() {
      throw new Error(
        "[Fumapress] Content loader is not initialized yet, please access it after init()",
      );
    },
    revalidateLoader: () => Promise.resolve(undefined),
    invalidateLoader: () => undefined,
    i18nConfig,
    defaultLayoutProps: async (opts) => {
      const { name, git } = ctx.siteConfig;
      const base =
        typeof defaultLayoutProps === "function"
          ? await defaultLayoutProps.call(ctx, opts)
          : defaultLayoutProps;

      // Fumadocs renders `githubUrl` as a GitHub icon link, other providers need their own link item
      const repo = git && !base?.githubUrl ? git : undefined;

      return {
        ...base,
        githubUrl: base?.githubUrl ?? (repo?.provider === "github" ? getRepoUrl(repo) : undefined),
        links:
          repo && repo.provider !== "github"
            ? [...(base?.links ?? []), getRepoLinkItem(repo)]
            : base?.links,
        nav: {
          ...base?.nav,
          title: base?.nav?.title ?? name,
        },
      };
    },
    renderNotFound,
    renderPage,
    renderRoot,
    localizePath: (lang, pathname) => localizePath(ctx.i18nConfig, lang, pathname),
    plugins: await preinitPlugins(config.preset, config.plugins ?? [], { mode }),
    adapters: config.adapters ?? [],
    data: {},
    translationsConfig: translations,
    mode,
    siteConfig: {
      name: site?.name ?? "Fumapress",
      baseUrl: site?.baseUrl ?? getDefaultBaseUrl(),
      trailingSlash: site?.trailingSlash,
      hreflang: site?.hreflang,
      git: site?.git
        ? {
            ...site.git,
            provider: site.git.provider ?? "github",
            url: (site.git.url ?? defaultGitProviderUrls[site.git.provider ?? "github"]).replace(
              /\/$/,
              "",
            ),
            rootDir: site.git.rootDir ?? getGitRootDir() ?? process.cwd(),
          }
        : undefined,
    },
    ...hooks(config, i18nConfig),
  };

  if ((ctx.i18nConfig as I18nConfig | undefined)?.hideLocale === "always") {
    throw new Error(
      '[Fumapress] `hideLocale: "always"` is not supported, languages are told apart by their URL prefix. Use `hideLocale: "default-locale"` to drop the prefix of the default language only.',
    );
  }

  for (const plugin of ctx.plugins) {
    await plugin.init?.call(ctx);
  }

  let loaderOptions: PressLoaderOptions = {
    baseUrl: "/",
    i18n: ctx.i18nConfig,
    ...config.loaderOptions,
  };

  for (const plugin of ctx.plugins) {
    if (!plugin.configureLoader) continue;
    loaderOptions = await plugin.configureLoader.call(ctx, loaderOptions);
  }

  const source = dynamicLoader(config.content, loaderOptions);
  ctx.revalidateLoader = source.revalidate.bind(source);
  ctx.invalidateLoader = source.invalidate.bind(source);
  ctx.getLoader = () => {
    // only invalidate because `get()` will do the revalidation part
    if (config.loaderOptions?.alwaysRevalidate) source.invalidate();
    return source.get() as never;
  };

  for (const plugin of ctx.plugins) {
    await plugin.configure?.call(ctx);
  }

  return ctx as unknown as AppContext<C>;
}

function hooks<S extends AppShape>(
  config: FumapressConfig,
  i18n: I18nConfig | undefined,
): FumapressHooks<S> {
  const rootMetaInterceptors: RootMetaInterceptor[] = [];
  const pageMetaInterceptors: PageMetaInterceptor<S>[] = [];

  return {
    interceptPageMeta(interceptor) {
      pageMetaInterceptors.push(interceptor);
    },
    interceptRootMeta(interceptor) {
      rootMetaInterceptors.push(interceptor);
    },
    renderRootMeta() {
      const ctx = getPressContext();
      function next(i: number): ReactNode {
        const interceptor = rootMetaInterceptors[i];
        if (!interceptor) return config.meta?.root?.call(ctx);
        return interceptor({ next: () => next(i + 1) });
      }

      return next(0);
    },
    renderPageMeta(page) {
      const context = getPressContext();

      function next(i: number): ReactNode {
        const interceptor = pageMetaInterceptors[i];
        if (!interceptor) {
          const { title, description } = page.data;

          return (
            <>
              <title>{title}</title>
              {description && <meta name="description" content={description} />}
              <meta property="og:title" content={title} />
              {description && <meta property="og:description" content={description} />}
              <meta property="og:site_name" content={context.siteConfig.name} />
              <PageLinks page={page} />
              {config.meta?.page?.call(context, page)}
            </>
          );
        }
        return interceptor({ page, next: () => next(i + 1) });
      }

      return next(0);
    },
    isFallbackPage(page) {
      return isFallbackPage(page, i18n);
    },
    async getPageAlternates(page) {
      if (!i18n) return [];
      const ctx = getPressContext();
      const source = await ctx.getLoader();
      const out: PageAlternate[] = [];

      for (const locale of i18n.languages) {
        const target = source.getPage(page.slugs, locale);
        if (!target || isFallbackPage(target, i18n)) continue;

        out.push({
          locale,
          hreflang: ctx.siteConfig.hreflang?.[locale] ?? locale,
          href: ctx.absoluteUrl(target.url),
        });
      }

      return out.length > 1 ? out : [];
    },
    absoluteUrl(pathname, { file = false } = {}) {
      const { baseUrl, trailingSlash } = getPressContext().siteConfig;

      if (!file && trailingSlash !== undefined && pathname !== "/") {
        if (trailingSlash && !pathname.endsWith("/")) pathname += "/";
        else if (!trailingSlash && pathname.endsWith("/")) pathname = pathname.slice(0, -1);
      }

      return baseUrl ? new URL(pathname, baseUrl).href : pathname;
    },
    async getPageCreatedAt(page) {
      const ctx = getPressContext();

      for (const adapter of ctx.adapters) {
        const date = await adapter["core:get-creation-date"]?.call(ctx, page);
        if (date !== undefined) return date;
      }
    },
    async getPageLastModified(page) {
      const ctx = getPressContext();

      for (const adapter of ctx.adapters) {
        const date = await adapter["core:get-modified-date"]?.call(ctx, page);
        if (date !== undefined) return date;
      }
    },
    async getPageBody(page) {
      const ctx = getPressContext();

      for (const adapter of ctx.adapters) {
        const body = await adapter["core:get-body"]?.call(ctx, page);
        if (body !== undefined) return body;
      }
    },
    async getPageToc(page) {
      const ctx = getPressContext();
      for (const adapter of ctx.adapters) {
        const toc = await adapter["core:render-toc"]?.call(ctx, page);
        if (toc !== undefined) return toc;
      }
    },
    getFileUrl(absolutePath) {
      const { git } = getPressContext().siteConfig;
      if (!git) return;

      const p = path.relative(git.rootDir, absolutePath).replaceAll(path.sep, "/");
      if (p.startsWith("../")) return;

      return getFileUrl(git, p);
    },
  };
}

/** canonical, `hreflang` and robots tags, they need the content loader */
async function PageLinks({ page }: { page: Page }) {
  const ctx = getPressContext();
  const i18n = ctx.i18nConfig as I18nConfig | undefined;
  const fallback = ctx.isFallbackPage(page);
  let canonical = page.url;

  if (fallback) {
    const source = await ctx.getLoader();
    canonical = source.getPage(page.slugs, getFileLocale(page, i18n))?.url ?? page.url;
  }

  const url = ctx.siteConfig.baseUrl ? ctx.absoluteUrl(canonical) : undefined;
  const alternates = await ctx.getPageAlternates(page);
  const xDefault =
    alternates.find((item) => item.locale === i18n?.defaultLanguage) ?? alternates[0];

  return (
    <>
      {url && <link rel="canonical" href={url} />}
      {url && <meta property="og:url" content={url} />}
      {alternates.map((item) => (
        <link key={item.locale} rel="alternate" hrefLang={item.hreflang} href={item.href} />
      ))}
      {xDefault && <link rel="alternate" hrefLang="x-default" href={xDefault.href} />}
      {fallback && <meta name="robots" content="noindex" />}
    </>
  );
}

/**
 * Locale owning the file of page according to `i18n.parser`, `undefined` for files shared by every language (`$`).
 */
export function getFileLocale(page: Page, i18n: I18nConfig | undefined): string | undefined {
  if (!i18n) return;
  let locale: string | undefined;

  if (i18n.parser === "dir") {
    const idx = page.path.indexOf("/");
    if (idx !== -1) locale = page.path.slice(0, idx);
  } else {
    const parts = page.path.slice(page.path.lastIndexOf("/") + 1).split(".");
    if (parts.length >= 3) locale = parts[parts.length - 2];
  }

  if (locale === "$") return;
  return locale !== undefined && i18n.languages.includes(locale) ? locale : i18n.defaultLanguage;
}

export function isFallbackPage(page: Page, i18n: I18nConfig | undefined): boolean {
  const locale = getFileLocale(page, i18n);
  return locale !== undefined && locale !== page.locale;
}

const loaderViews = new WeakMap<object, unknown>();

/** a view of the loader without fallback pages, for APIs that scan `getPages()` themselves */
export function withoutFallbackPages<T extends Pick<LoaderOutput, "getPages">>(
  source: T,
  i18n: I18nConfig | undefined,
): T {
  if (!i18n) return source;
  let view = loaderViews.get(source) as T | undefined;

  if (!view) {
    view = Object.create(source, {
      getPages: {
        value: (lang?: string) =>
          source.getPages(lang).filter((page) => !isFallbackPage(page, i18n)),
      },
    }) as T;
    loaderViews.set(source, view);
  }

  return view;
}

function getDefaultBaseUrl() {
  const platform =
    import.meta.env.FUMAPRESS_PLATFORM === "cloudflare"
      ? " and Cloudflare Workers Builds does not expose the site URL"
      : "";
  console.warn(
    `[Fumapress] "site.baseUrl" is not set${platform}; sitemap and RSS will fall back to relative URLs.`,
  );
  if (import.meta.env.DEV) {
    return "http://localhost:3000";
  }
  const vercelUrl = import.meta.env.VERCEL_URL;
  if (vercelUrl) {
    return `https://${vercelUrl}`;
  }
}

export const deepmerge = createDeepmerge({
  all: true,
  onlyDefinedProperties: true,
  isMergeableObject(value) {
    if (isValidElement(value)) {
      return false;
    }

    return createDeepmerge.isMergeableObject(value);
  },
});

/** can be extended from other libraries */
export interface AppContextData<S extends AppShape> {
  "core:docs-layout"?: DocsLayoutContextData<S>;
  "core:notebook-layout"?: NotebookLayoutContextData<S>;
  "core:glass-layout"?: GlassLayoutContextData<S>;
  "core:home-layout"?: HomeLayoutContextData<S>;
  "core:provider"?: RootLayoutContextData<S>;
  "core:takumi"?: TakumiContextData<S>;
}
