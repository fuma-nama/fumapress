import type { AppContext } from "./lib/shared";
import type {
  ContentStorage,
  ContentStorageMetaFile,
  ContentStoragePageFile,
  LoaderConfig,
  LoaderOutput,
  Meta,
  Page,
  SourceUnion,
} from "fumadocs-core/source";
import type { Awaitable, Adapter, ServerPluginOption, PressLoaderOptions } from "@/lib/types";
import type { I18nConfig, SingularTranslationsAPI, TranslationsAPI } from "fumadocs-core/i18n";
import type { FC, ReactNode } from "react";
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import type { Translations } from "fumadocs-ui/i18n";

export interface ConfigContext {
  page: Page;
  meta: Meta;
  lang: string | undefined;
  /** source names in multi-source setup */
  source: string | undefined;
}

export type BuildMode = "static" | "dynamic" | "default";

// TODO: expose from Fumadocs
type AnyInput = SourceUnion | Record<string, SourceUnion>;
type GeneratePageFile<T extends AnyInput> =
  T extends Record<infer K extends string, SourceUnion>
    ? {
        [k in K]: T[k] extends SourceUnion<infer D>
          ? ContentStoragePageFile<k, D["pageData"]>
          : never;
      }[K]
    : T extends SourceUnion<infer D>
      ? ContentStoragePageFile<undefined, D["pageData"]>
      : never;
type GenerateMetaFile<T extends AnyInput> =
  T extends Record<infer K extends string, SourceUnion>
    ? {
        [k in K]: T[k] extends SourceUnion<infer D>
          ? ContentStorageMetaFile<k, D["metaData"]>
          : never;
      }[K]
    : T extends SourceUnion<infer D>
      ? ContentStorageMetaFile<undefined, D["metaData"]>
      : never;
type GenerateStorage<T extends AnyInput> = ContentStorage<GeneratePageFile<T>, GenerateMetaFile<T>>;
type GeneratePage<T extends AnyInput> =
  T extends Record<infer K extends string, SourceUnion>
    ? { [k in K]: T[k] extends SourceUnion<infer D> ? Page<k, D["pageData"]> : never }[K]
    : T extends SourceUnion<infer D>
      ? Page<undefined, D["pageData"]>
      : never;
type GenerateMeta<T extends AnyInput> =
  T extends Record<infer K extends string, SourceUnion>
    ? { [k in K]: T[k] extends SourceUnion<infer D> ? Meta<k, D["metaData"]> : never }[K]
    : T extends SourceUnion<infer D>
      ? Meta<undefined, D["metaData"]>
      : never;

export interface ConfigContextToLoaderConfig<T extends ConfigContext> {
  page: T["page"];
  meta: T["meta"];
  i18n: T["lang"] extends string ? I18nConfig<T["lang"]> : undefined;
}

export interface BaseConfig<C extends ConfigContext> {
  /**
   * - `static`: always prefer static, including search etc.
   * - `dynamic`: always prefer dynamic.
   * - `default`: only certain parts like search routes are dynamic.
   */
  mode?: BuildMode;
  site?: SiteConfig;

  translations?:
    | (C["lang"] extends string ? TranslationsAPI<C["lang"], { ui: Translations }> : never)
    | SingularTranslationsAPI<{ ui: Translations }>;
  meta?: {
    /** render meta tags for any pages */
    root?: (this: AppContext<C>) => ReactNode;

    /** render meta tags for page */
    page?: (this: AppContext<C>, page: C["page"]) => ReactNode;
  };
}

interface ConfigWithLoader<L extends LoaderConfig = LoaderConfig> extends BaseConfig<{
  meta: NoInfer<L>["meta"];
  page: NoInfer<L>["page"];
  lang: NoInfer<L>["i18n"] extends I18nConfig<infer Lang> ? Lang : undefined;
  source: undefined;
}> {
  /** the content loader (static, called once only for every process) */
  loader?: LoaderOutput<L>;
}

interface ConfigWithContent<
  I extends AnyInput = AnyInput,
  Lang extends string | undefined = string | undefined,
> extends BaseConfig<{
  lang: Lang;
  meta: GenerateMeta<NoInfer<I>>;
  page: GeneratePage<NoInfer<I>>;
  source: I extends Record<infer K, SourceUnion> ? K : undefined;
}> {
  /** The content sources */
  content: I;

  /** i18n config for core, optional when `translations` is specified */
  i18n?: Lang extends string ? I18nConfig<Lang> : undefined;

  /** Options for Fumadocs Loader API */
  loaderOptions?: Omit<PressLoaderOptions<GenerateStorage<I>, never>, "baseUrl" | "i18n"> & {
    /**
     * Always revalidate all dynamic content sources in `content` (on each request).
     * By default, you can revalidate manually with `getPressContext<Ctx>().revalidateLoader(...)`.
     *
     * @default false
     */
    alwaysRevalidate?: boolean;
  };
}

export interface Layouts<C extends ConfigContext = ConfigContext> {
  root: FC<{ lang?: string; children: ReactNode }> & { $ctx?: C };
  page: FC<{
    lang?: string;
    slugs: string[];
    page: C["page"];
  }> & { $ctx?: C };
  notFound: FC<{ lang?: string }> & { $ctx?: C };

  /**
   * Define default props for all Fumadocs layouts, will be deep-merged with current props.
   */
  defaultProps?: (
    this: AppContext<C>,
    env: { lang: string | undefined },
  ) => Awaitable<Omit<BaseLayoutProps, "children">>;
}

export interface SiteConfig {
  /** full URL of app, used for metadata generation*/
  baseUrl?: string;

  name?: string;
  git?: {
    user: string;
    repo: string;
    branch: string;

    /** the root directory of git repo */
    rootDir?: string;
  };
}

export interface ConfigBuilder<C extends ConfigContext = ConfigContext> {
  /** for type inference only, always `undefined` */
  $context: C;
  get: () => (ConfigWithLoader | ConfigWithContent) & {
    plugins: ServerPluginOption[];
    layouts: Partial<Layouts>;
    adapters: Adapter[];
  };

  /** alias for `usePlugins()` */
  plugins: (...plugins: ServerPluginOption<C>[]) => ConfigBuilder<C>;
  /** alias for `useAdapters()` */
  adapters: (...adapters: Adapter<C>[]) => ConfigBuilder<C>;
  /** alias for `useLayouts()` */
  layouts: (layouts: Partial<Layouts<C>>) => ConfigBuilder<C>;

  usePlugins: (...plugins: ServerPluginOption<C>[]) => ConfigBuilder<C>;
  useLayouts: (layouts: Partial<Layouts<C>>) => ConfigBuilder<C>;
  /** Add adapter for content sources */
  useAdapters: (...adapters: Adapter<C>[]) => ConfigBuilder<C>;
}

export function defineConfig<I extends AnyInput, Lang extends string | undefined = undefined>(
  config: ConfigWithContent<I, Lang>,
): ConfigBuilder<{
  lang: Lang;
  meta: GenerateMeta<I>;
  page: GeneratePage<I>;
  source: I extends Record<infer K, SourceUnion> ? K : undefined;
}>;

export function defineConfig<L extends LoaderConfig>(
  config?: ConfigWithLoader<L>,
): ConfigBuilder<{
  lang: L["i18n"] extends I18nConfig<infer Lang> ? Lang : undefined;
  page: L["page"];
  meta: L["meta"];
  source: undefined;
}>;

export function defineConfig(config?: ConfigWithContent | ConfigWithLoader): ConfigBuilder<any> {
  const plugins: ServerPluginOption[] = [];
  const layouts: Partial<Layouts> = {};
  const adapters: Adapter[] = [];

  return {
    $context: undefined as never,
    get() {
      return { ...config, plugins, layouts, adapters };
    },
    plugins(...plugins) {
      return this.usePlugins(...plugins);
    },
    adapters(...adapters) {
      return this.useAdapters(...adapters);
    },
    layouts(layouts) {
      return this.useLayouts(layouts);
    },
    useAdapters(...values) {
      adapters.push(...values);
      return this;
    },
    useLayouts(overrides) {
      Object.assign(layouts, overrides);
      return this;
    },
    usePlugins(...values) {
      plugins.push(...values);
      return this;
    },
  } satisfies ConfigBuilder;
}
