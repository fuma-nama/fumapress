import type { BaseConfig, BuildMode, ConfigBuilder, ConfigContext, Layouts } from "@/config";
import { getGitRootDir } from "./fs";
import path from "node:path";
import { loader, type LoaderOutput } from "fumadocs-core/source";
import type {
  Awaitable,
  Adapter,
  ServerPlugin,
  AppContextData,
  ServerPluginOption,
  PressLoaderOptions,
} from "./types";
import { type ComponentType, Fragment, isValidElement, type ReactNode } from "react";
import createDeepmerge from "@fastify/deepmerge";
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { disableSearchPlugin } from "@/plugins/internal/disable-search";
import { AsyncLocalStorage } from "node:async_hooks";
import { dynamicLoader } from "fumadocs-core/source/dynamic";
import { resolveImageConfig } from "./shared/image";

export interface AppContext<C extends ConfigContext = ConfigContext> {
  mode: BuildMode;
  getLoader: () => Awaitable<LoaderOutput<C>>;
  plugins: ServerPlugin<C>[];
  adapters: Adapter<C>[];
  layouts: Layouts<C>;

  /** revalidate [dynamic content sources](https://fumadocs.dev/docs/headless/source-api/source#dynamic-source) */
  revalidateLoader:
    | (() => Promise<void>)
    | (C["source"] extends string ? (name: C["source"]) => Promise<void> : never);

  /** invalidate [dynamic content sources](https://fumadocs.dev/docs/headless/source-api/source#dynamic-source) */
  invalidateLoader:
    | (() => void)
    | (C["source"] extends string ? (name: C["source"]) => void : never);

  /** always `undefined`, easier way to infer types */
  $context: C;

  /**
   * custom data in app context, can be referenced from plugins/pages etc
   */
  data: AppContextData & Record<string, unknown>;

  translationsConfig?: BaseConfig<C>["translations"];
  i18nConfig?: C["i18n"];
  metaConfig?: BaseConfig<C>["meta"];
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

declare global {
  // TODO: Waku.js doesn't run middlewares during build, must set the context stores somewhere else
  var appContextTemp: AppContext | undefined;
}

export const appContext = new AsyncLocalStorage({
  name: "fumapress:core",
});

export function getPressContext<C extends ConfigContext = ConfigContext>(): AppContext<C> {
  let store = appContext.getStore();
  if (!store) {
    store = global.appContextTemp;
  } else {
    delete global.appContextTemp;
  }

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

function flattenPlugins(plugins: ServerPluginOption[]): ServerPlugin[] {
  const out: ServerPlugin[] = [];
  for (const plugin of plugins) {
    if (!plugin) continue;
    if (Array.isArray(plugin)) out.push(...flattenPlugins(plugin));
    else out.push(plugin);
  }
  return out;
}

function resolvePlugins(plugins: ServerPluginOption[]): ServerPlugin[] {
  return flattenPlugins(plugins).sort(
    (a, b) => PLUGIN_ORDER[a.enforce ?? "_"] - PLUGIN_ORDER[b.enforce ?? "_"],
  );
}

export async function initApp<C extends ConfigContext>(
  builder: ConfigBuilder<C>,
): Promise<AppContext<C>> {
  const config = builder.get();
  const {
    translations,
    site,
    mode = "default",
    layouts,
    unstable_imageOptimization: imageOptimization = false,
  } = config;

  const plugins = resolvePlugins([
    ...config.plugins,
    disableSearchPlugin(),
    imageOptimization &&
      (await import("@/plugins/internal/image")).imagePlugin(
        imageOptimization === true ? resolveImageConfig() : resolveImageConfig(imageOptimization),
      ),
  ]);
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
        : undefined,
    layouts: {
      ...layouts,
      root: layouts.root ?? (await import("@/layouts/root")).createRootLayout(),
      page: layouts.page ?? (await import("@/layouts/docs")).createDocsLayoutPage(),
      notFound:
        layouts.notFound ?? (await import("fumadocs-ui/layouts/home/not-found")).DefaultNotFound,
    },
    plugins,
    adapters: config.adapters,
    data: {},
    translationsConfig: translations,
    mode,
    metaConfig: config.meta as AppContext["metaConfig"],
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
  };

  if ("loader" in config && config.loader) {
    ctx.i18nConfig ??= config.loader._i18n;
    ctx.getLoader = () => config.loader as never;
  } else if ("content" in config) {
    ctx.i18nConfig ??= config.i18n;
  } else {
    console.warn("[Fumapress] loader is not specified in your config, is it a mistake?");
    const emptyLoader = loader({}, { baseUrl: "/" });

    ctx.getLoader = () => emptyLoader as never;
  }

  for (const plugin of plugins) {
    await plugin.init?.call(ctx);
  }

  if ("content" in config) {
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
  }

  return ctx as unknown as AppContext<C>;
}

function getDefaultBaseUrl() {
  console.warn(
    '[Fumapress] It is recommended to specify "site.baseUrl" in your config for better SEO.',
  );
  if (import.meta.env.DEV) {
    return "http://localhost:3000";
  }
}

export function renderRootMeta<C extends ConfigContext>(context: AppContext<C>): ReactNode {
  return context.metaConfig?.root?.call(context);
}

export function renderPageMeta<C extends ConfigContext>(
  page: C["page"],
  context: AppContext<C>,
): ReactNode {
  return (
    <>
      <title>{page.data.title}</title>
      <meta property="og:title" content={page.data.title} />
      {page.data.description && <meta property="og:description" content={page.data.description} />}
      {context.metaConfig?.page?.call(context, page)}
      {context.data["core:page-meta"]?.map((hook, i) => (
        <Fragment key={i}>{hook(page)}</Fragment>
      ))}
    </>
  );
}

export function getGitHubFileUrl<C extends ConfigContext>(
  ctx: AppContext<C>,
  absolutePath: string,
): string | undefined {
  const { git } = ctx.siteConfig;
  if (!git) return;

  const p = path.relative(git.rootDir, absolutePath).replaceAll(path.sep, "/");
  if (p.startsWith("../")) return;

  return `https://github.com/${git.user}/${git.repo}/blob/${git.branch}/${p}`;
}

export function baseLayoutProps<C extends ConfigContext>(ctx: AppContext<C>) {
  const { name, git } = ctx.siteConfig;

  return {
    githubUrl: git ? `https://github.com/${git.user}/${git.repo}` : undefined,
    nav: {
      title: name,
    },
  } satisfies BaseLayoutProps;
}

export type TransformChildren<T> = Omit<T, "children"> & {
  children?: ((nodes: ReactNode) => ReactNode)[];
};

export function createTransformChildren<T>(
  Component: ComponentType<T>,
): ComponentType<{ props: TransformChildren<T>; children: ReactNode }> {
  return function ({ props, children }) {
    if (props.children) {
      for (const transformer of props.children) {
        children = transformer(children);
      }
    }

    return <Component {...(props as T)}>{children}</Component>;
  };
}

export async function renderBody<C extends ConfigContext>(
  ctx: AppContext<C>,
  page: C["page"],
  errorMessage: string,
) {
  for (const adapter of ctx.adapters) {
    const body = await adapter["core:render-body"]?.call(ctx, page);
    if (body !== undefined) return body;
  }

  throw new Error(errorMessage);
}

export async function renderToc<C extends ConfigContext>(ctx: AppContext<C>, page: C["page"]) {
  for (const adapter of ctx.adapters) {
    const toc = await adapter["core:render-toc"]?.call(ctx, page);
    if (toc !== undefined) return toc;
  }
}

export async function getCreationDate<C extends ConfigContext>(
  ctx: AppContext<C>,
  page: C["page"],
) {
  for (const adapter of ctx.adapters) {
    const date = await adapter["core:get-creation-date"]?.call(ctx, page);
    if (date !== undefined) return date;
  }
}

export async function getLastModifiedDate<C extends ConfigContext>(
  ctx: AppContext<C>,
  page: C["page"],
) {
  for (const adapter of ctx.adapters) {
    const date = await adapter["core:get-modified-date"]?.call(ctx, page);
    if (date !== undefined) return date;
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
