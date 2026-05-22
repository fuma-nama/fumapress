import type { BuildMode, ConfigBuilder, ConfigContext, Layouts, MetaConfig } from "@/config";
import { getGitRootDir } from "./fs";
import path from "node:path";
import type { LoaderOutput } from "fumadocs-core/source";
import type { Awaitable, Adapter, ServerPlugin, AppContextData, ServerPluginOption } from "./types";
import { type ComponentType, Fragment, isValidElement, type ReactNode } from "react";
import { fumadocsMdx } from "@/adapters/mdx";
import createDeepmerge from "@fastify/deepmerge";
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { disableSearchPlugin } from "@/plugins/internal/disable-search";
import type { I18nConfig, SingularTranslationsAPI, TranslationsAPI } from "fumadocs-core/i18n";
import type { Translations } from "fumadocs-ui/i18n";

export interface AppContext<C extends ConfigContext = ConfigContext> {
  mode: BuildMode;
  getLoader: () => Awaitable<LoaderOutput<C["loaderConfig"]>>;
  plugins: ServerPlugin<C>[];
  adapters: Adapter<C>[];
  layouts: Layouts<C>;

  /** always `undefined`, easier way to infer types */
  $context: C;

  /**
   * custom data in app context, can be referenced from plugins/pages etc
   */
  data: AppContextData & Record<string, unknown>;

  i18nConfig?: I18nConfig<C["lang"]>;
  translationsConfig?:
    | TranslationsAPI<C["lang"], { ui: Translations }>
    | SingularTranslationsAPI<{ ui: Translations }>;
  metaConfig?: MetaConfig<C>;
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

export async function parseConfig<C extends ConfigContext>(
  config: ConfigBuilder<C>,
): Promise<AppContext<C>> {
  let adapters = config.getAdapters();
  if (adapters.length === 0) adapters = [fumadocsMdx()];
  const ORDER = {
    pre: -1,
    post: 1,
    _: 0,
  };

  function resolvePlugins(plugins: ServerPluginOption<C>[]): ServerPlugin<C>[] {
    const flat: ServerPlugin<C>[] = plugins.flat(Infinity as never);
    flat.push(disableSearchPlugin());

    return flat.sort((a, b) => ORDER[a.enforce ?? "_"] - ORDER[b.enforce ?? "_"]);
  }

  const layouts = config.getLayouts();
  return {
    getLoader() {
      if (typeof config.loader === "function") return config.loader();

      return config.loader;
    },
    layouts: {
      ...layouts,
      root: layouts.root ?? (await import("@/layouts/root")).createRootLayout<C>(),
      page: layouts.page ?? (await import("@/layouts/docs")).createDocsLayoutPage<C>(),
      notFound:
        layouts.notFound ?? (await import("fumadocs-ui/layouts/home/not-found")).DefaultNotFound,
    },

    plugins: resolvePlugins(config.getPlugins()),
    adapters,
    $context: undefined as never,
    data: {},
    i18nConfig:
      config.i18n ??
      (config.translations && "config" in config.translations
        ? config.translations.config
        : undefined),
    translationsConfig: config.translations,
    mode: config.mode ?? "default",
    metaConfig: config.meta,
    siteConfig: {
      name: config.site?.name ?? "Fumapress",
      baseUrl: config.site?.baseUrl,
      git: config.site?.git
        ? {
            ...config.site.git,
            rootDir: config.site.git.rootDir ?? getGitRootDir() ?? process.cwd(),
          }
        : undefined,
    },
  };
}

export function renderRootMeta<C extends ConfigContext>(context: AppContext<C>): ReactNode {
  return context.metaConfig?.root?.call(context);
}

export function renderPageMeta<C extends ConfigContext>(
  page: C["loaderConfig"]["page"],
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
  page: C["loaderConfig"]["page"],
  errorMessage: string,
) {
  for (const adapter of ctx.adapters) {
    const body = await adapter["core:render-body"]?.call(ctx, page);
    if (body !== undefined) return body;
  }

  throw new Error(errorMessage);
}

export async function renderToc<C extends ConfigContext>(
  ctx: AppContext<C>,
  page: C["loaderConfig"]["page"],
) {
  for (const adapter of ctx.adapters) {
    const toc = await adapter["core:render-toc"]?.call(ctx, page);
    if (toc !== undefined) return toc;
  }
}

export async function getCreationDate<C extends ConfigContext>(
  ctx: AppContext<C>,
  page: C["loaderConfig"]["page"],
) {
  for (const adapter of ctx.adapters) {
    const date = await adapter["core:get-creation-date"]?.call(ctx, page);
    if (date !== undefined) return date;
  }
}

export async function getLastModifiedDate<C extends ConfigContext>(
  ctx: AppContext<C>,
  page: C["loaderConfig"]["page"],
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
