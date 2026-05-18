import type { AppContext } from "./lib/shared";
import type { LoaderConfig, LoaderOutput } from "fumadocs-core/source";
import type { Awaitable, Adapter, ServerPluginOption } from "@/lib/types";
import type { TranslationsOption } from "fumadocs-ui/contexts/i18n";
import type { I18nConfig as CoreI18nConfig } from "fumadocs-core/i18n";
import type { ComponentType, ReactNode } from "react";
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

export interface ConfigContext {
  loaderConfig: LoaderConfig;
  lang: string;
}

export type BuildMode = "static" | "dynamic" | "default";

export interface Config<C extends ConfigContext = ConfigContext> {
  /**
   * - `static`: always prefer static, including search etc.
   * - `dynamic`: always prefer dynamic.
   * - `default`: only certain parts like search routes are dynamic.
   */
  mode?: BuildMode;

  /** the default content loader */
  loader: LoaderOutput<C["loaderConfig"]> | (() => Awaitable<LoaderOutput<C["loaderConfig"]>>);

  site?: SiteConfig;
  i18n?: I18nConfig<C["lang"]>;
  meta?: MetaConfig<NoInfer<C>>;
}

export interface Layouts<C extends ConfigContext = ConfigContext> {
  root: ComponentType<{ lang?: string; ctx: AppContext<C>; children: ReactNode }>;
  page: ComponentType<{
    lang?: string;
    slugs: string[];
    ctx: AppContext<C>;
    page: C["loaderConfig"]["page"];
  }>;
  notFound: ComponentType<{ lang?: string; ctx: AppContext<C> }>;

  /**
   * Define default props for page layouts, will be merged with current props.
   */
  defaultProps?: (
    this: AppContext<C>,
    env: { lang: string | undefined },
  ) => Awaitable<Omit<BaseLayoutProps, "children">>;
}

export interface I18nConfig<Lang extends string = string> extends Pick<
  CoreI18nConfig<NoInfer<Lang>>,
  "defaultLanguage" | "fallbackLanguage" | "parser"
> {
  /** locale code -> language info */
  languages: {
    [K in Lang]: {
      displayName: string;
      translations?: TranslationsOption;
    };
  };
}

export interface MetaConfig<C extends ConfigContext = ConfigContext> {
  /** render meta tags for any pages */
  root?: (this: AppContext<C>) => ReactNode;

  /** render meta tags for page */
  page?: (this: AppContext<C>, page: C["loaderConfig"]["page"]) => ReactNode;
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

export interface I18nConfigBuilder<Lang extends string> extends I18nConfig<Lang> {
  /** convert Fumapress i18n config to core i18n config */
  toCore: () => CoreI18nConfig<Lang>;
}

export interface ConfigBuilder<C extends ConfigContext> extends Config<C> {
  getPlugins: () => ServerPluginOption<C>[];
  getLayouts: () => Partial<Layouts<C>>;
  getAdapters: () => Adapter<C>[];

  usePlugins: (...plugins: ServerPluginOption<C>[]) => ConfigBuilder<C>;
  useLayouts: (layouts: Partial<Layouts<C>>) => ConfigBuilder<C>;
  /** Add adapter for content sources, use `fumadocs-mdx` if not specified */
  useAdapters: (...adapters: Adapter<C>[]) => ConfigBuilder<C>;
}

export function defineConfig<C extends LoaderConfig, L extends string = string>(
  config: Config<{
    loaderConfig: C;
    lang: L;
  }>,
): ConfigBuilder<{ loaderConfig: C; lang: L }> {
  const plugins: ServerPluginOption<{ loaderConfig: C; lang: L }>[] = [];
  const layouts: Partial<
    Layouts<{
      loaderConfig: C;
      lang: L;
    }>
  > = {};
  const adapters: Adapter<{
    loaderConfig: C;
    lang: L;
  }>[] = [];

  return {
    ...config,
    getPlugins() {
      return plugins;
    },
    getAdapters() {
      return adapters;
    },
    getLayouts() {
      return layouts;
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
  };
}

export function defineI18nConfig<Lang extends string>(
  config: I18nConfig<Lang>,
): I18nConfigBuilder<Lang> {
  return {
    ...config,
    toCore() {
      return {
        defaultLanguage: this.defaultLanguage,
        fallbackLanguage: this.fallbackLanguage,
        parser: this.parser,
        languages: Object.keys(this.languages) as Lang[],
      };
    },
  };
}
