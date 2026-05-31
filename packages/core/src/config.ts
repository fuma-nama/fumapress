import type { AppContext } from "./lib/shared";
import type {
  LoaderConfig,
  LoaderOutput,
  Meta,
  _Internal,
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
  i18n: I18nConfig | undefined;
  /** source names in multi-source setup */
  source: string | undefined;
}

export type BuildMode = "static" | "dynamic" | "default";

export interface BaseConfig<C extends ConfigContext> {
  /**
   * - `static`: always prefer static, including search etc.
   * - `dynamic`: always prefer dynamic.
   * - `default`: only certain parts like search routes are dynamic.
   */
  mode?: BuildMode;
  site?: SiteConfig;

  translations?:
    | (C["i18n"] extends I18nConfig<infer Lang>
        ? TranslationsAPI<Lang, { ui: Translations }>
        : never)
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
  i18n: NoInfer<L>["i18n"];
  source: undefined;
}> {
  /**
   * The content loader.
   *
   * @deprecated Pass content sources directly to `content` instead.
   */
  loader?: LoaderOutput<L>;
}

interface ConfigWithContent<
  I extends _Internal.AnyInput = _Internal.AnyInput,
  I18n extends I18nConfig | undefined = I18nConfig | undefined,
> extends BaseConfig<{
  i18n: I18n;
  meta: _Internal.GenerateMeta<NoInfer<I>>;
  page: _Internal.GeneratePage<NoInfer<I>>;
  source: I extends Record<infer K, SourceUnion> ? K : undefined;
}> {
  /** The content sources */
  content: I;

  /** i18n config for core, optional when `translations` is specified */
  i18n?: I18n;

  /** Options for Fumadocs Loader API */
  loaderOptions?: Omit<
    PressLoaderOptions<_Internal.GenerateStorage<I>, I18n>,
    "baseUrl" | "i18n"
  > & {
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

export function defineConfig<
  I extends _Internal.AnyInput,
  I18n extends I18nConfig | undefined = undefined,
>(
  config: ConfigWithContent<I, I18n>,
): ConfigBuilder<{
  meta: _Internal.GenerateMeta<I>;
  page: _Internal.GeneratePage<I>;
  source: I extends Record<infer K, SourceUnion> ? K : undefined;
  i18n: I18n;
}>;

export function defineConfig<L extends LoaderConfig>(
  config?: ConfigWithLoader<L>,
): ConfigBuilder<{
  i18n: L["i18n"];
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
