import type { AppContext } from "./lib/shared";
import type { LoaderConfig, LoaderOutput } from "fumadocs-core/source";
import type { Awaitable, ServerPlugin, Adapter } from "@/lib/types";
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
  layouts?: Partial<Layouts>;
  plugins?: ServerPlugin[];
  /** adapter for content sources, use `fumadocs-mdx` if not specified */
  adapters?: Adapter[];
  i18n?: I18nConfig<C["lang"]>;
  meta?: MetaConfig<C>;
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
  usePlugins: (...plugins: ServerPlugin<C>[]) => ConfigBuilder<C>;
  useLayouts: (layouts: Partial<Layouts<C>>) => ConfigBuilder<C>;
  useAdapters: (...adapters: Adapter[]) => ConfigBuilder<C>;
}

export function defineConfig<C extends LoaderConfig, L extends string = string>(
  config: Config<{
    loaderConfig: C;
    lang: L;
  }>,
): ConfigBuilder<{ loaderConfig: C; lang: L }> {
  return {
    ...config,
    useAdapters(...adapters) {
      this.adapters ??= [];
      this.adapters.push(...adapters);
      return this;
    },
    useLayouts(layouts) {
      this.layouts ??= {};
      Object.assign(this.layouts, layouts);
      return this;
    },
    usePlugins(...plugins) {
      this.plugins ??= [];
      this.plugins.push(...(plugins as unknown as ServerPlugin[]));
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
