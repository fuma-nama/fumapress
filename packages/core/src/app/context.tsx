import type { FumapressConfig, BuildMode, ConfigUtils } from "@/config";
import { getGitRootDir } from "../lib/fs";
import path from "node:path";
import type { Meta, Page, LoaderOutput } from "fumadocs-core/source";
import type { Awaitable, Adapter, PressLoaderOptions } from "../lib/types";
import { isValidElement, type ReactNode } from "react";
import createDeepmerge from "@fastify/deepmerge";
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { AsyncLocalStorage } from "node:async_hooks";
import { dynamicLoader } from "fumadocs-core/source/dynamic";
import { applyDefaultsPlugin } from "@/plugins/internal/defaults";
import type { I18nConfig, SingularTranslationsAPI, TranslationsAPI } from "fumadocs-core/i18n";
import { PressPlugin, PressPluginOption } from "./plugin";
import type { TOCItemType } from "fumadocs-core/toc";
import type { DocsLayoutContextData } from "@/layouts/docs";
import type { HomeLayoutContextData } from "@/layouts/home";
import type { NotebookLayoutContextData } from "@/layouts/notebook";
import type { RootLayoutContextData } from "@/layouts/root";

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
  defaultLayoutProps: () => Awaitable<Omit<BaseLayoutProps, "children">>;
  renderPage: (opts: { slugs: string[]; lang?: string; page: S["page"] }) => ReactNode;
  renderRoot: (opts: { lang?: string; children: ReactNode }) => ReactNode;
  renderNotFound: (opts: { lang?: string }) => ReactNode;

  translationsConfig?:
    | ([S["lang"]] extends [string] ? TranslationsAPI<S["lang"]> : never)
    | SingularTranslationsAPI;
  i18nConfig?: [S["lang"]] extends [string] ? I18nConfig<S["lang"]> : undefined;
  siteConfig: {
    name: string;
    baseUrl?: string;
    git?: {
      user: string;
      repo: string;
      branch: string;
      rootDir: string;
    };
  };
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

  getFileGitHubUrl: (absolutePath: string) => Awaitable<string | undefined>;
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

const PLUGIN_ORDER = {
  pre: -1,
  post: 1,
  _: 0,
};

function flattenPlugins(plugins: PressPluginOption[]): PressPlugin[] {
  const out: PressPlugin[] = [];
  for (const plugin of plugins) {
    if (!plugin) continue;
    if (Array.isArray(plugin)) out.push(...flattenPlugins(plugin));
    else out.push(plugin);
  }
  return out;
}

function resolvePlugins(plugins: PressPluginOption[]): PressPlugin[] {
  return flattenPlugins(plugins).sort(
    (a, b) => PLUGIN_ORDER[a.enforce ?? "_"] - PLUGIN_ORDER[b.enforce ?? "_"],
  );
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

  const plugins = resolvePlugins([...(config.plugins ?? []), ...applyDefaultsPlugin()]);
  const ctx: AppContext = {
    $context: undefined as never,
    getLoader() {
      throw new Error(
        "[Fumapress] Content loader is not initialized yet, please access it after init()",
      );
    },
    revalidateLoader: () => Promise.resolve(undefined),
    invalidateLoader: () => undefined,
    i18nConfig:
      translations && "config" in translations
        ? (translations.config as AppContext["i18nConfig"])
        : config.i18n,
    defaultLayoutProps: async () => {
      const { name, git } = ctx.siteConfig;
      const base =
        typeof defaultLayoutProps === "function"
          ? await defaultLayoutProps.call(ctx)
          : defaultLayoutProps;

      return {
        ...base,
        githubUrl:
          base?.githubUrl ?? (git ? `https://github.com/${git.user}/${git.repo}` : undefined),
        nav: {
          ...base?.nav,
          title: base?.nav?.title ?? name,
        },
      };
    },
    renderNotFound,
    renderPage,
    renderRoot,
    plugins,
    adapters: config.adapters ?? [],
    data: {},
    translationsConfig: translations,
    mode,
    siteConfig: {
      name: site?.name ?? "Fumapress",
      baseUrl: site?.baseUrl ?? getDefaultBaseUrl(),
      git: site?.git
        ? {
            ...site.git,
            rootDir: site.git.rootDir ?? getGitRootDir() ?? process.cwd(),
          }
        : undefined,
    },
    ...hooks(config),
  };

  for (const plugin of plugins) {
    await plugin.init?.call(ctx);
  }

  let loaderOptions: PressLoaderOptions = {
    baseUrl: "/",
    i18n: ctx.i18nConfig,
    ...config.loaderOptions,
  };

  for (const plugin of plugins) {
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

  for (const plugin of plugins) {
    await plugin.configure?.call(ctx);
  }

  return ctx as unknown as AppContext<C>;
}

function hooks<S extends AppShape>(config: FumapressConfig): FumapressHooks<S> {
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
        if (!interceptor)
          return (
            <>
              <title>{page.data.title}</title>
              <meta property="og:title" content={page.data.title} />
              {page.data.description && (
                <meta property="og:description" content={page.data.description} />
              )}
              {config.meta?.page?.call(context, page)}
            </>
          );
        return interceptor({ page, next: () => next(i + 1) });
      }

      return next(0);
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
    getFileGitHubUrl(absolutePath) {
      const { git } = getPressContext().siteConfig;
      if (!git) return;

      const p = path.relative(git.rootDir, absolutePath).replaceAll(path.sep, "/");
      if (p.startsWith("../")) return;

      return `https://github.com/${git.user}/${git.repo}/blob/${git.branch}/${p}`;
    },
  };
}

function getDefaultBaseUrl() {
  console.warn(
    '[Fumapress] It is recommended to specify "site.baseUrl" in your config for better SEO.',
  );
  if (import.meta.env.DEV) {
    return "http://localhost:3000";
  }
  const vercelUrl = import.meta.env.VERCEL_URL;
  if (vercelUrl) {
    return `https://${vercelUrl}`;
  }
  const cloudflareUrl = import.meta.env.CF_PAGES_URL || import.meta.env.CLOUDFLARE_PAGES_URL;
  if (cloudflareUrl) {
    return /^https?:\/\//.test(cloudflareUrl) ? cloudflareUrl : `https://${cloudflareUrl}`;
  }
}

export const mergeLayoutConfigs = createDeepmerge({
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
  "core:home-layout"?: HomeLayoutContextData<S>;
  "core:provider"?: RootLayoutContextData;
}
