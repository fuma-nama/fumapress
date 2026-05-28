import type { AppContext } from "./lib/shared";
import type { LoaderConfig, LoaderOutput } from "fumadocs-core/source";
import type { Awaitable, Adapter, ServerPluginOption } from "@/lib/types";
import type { I18nConfig, SingularTranslationsAPI, TranslationsAPI } from "fumadocs-core/i18n";
import type { FC, ReactNode } from "react";
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import type { Translations } from "fumadocs-ui/i18n";

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
  loader?: LoaderOutput<C["loaderConfig"]> | (() => Awaitable<LoaderOutput<C["loaderConfig"]>>);

  site?: SiteConfig;
  /** this is optional if you have defined `translations` */
  i18n?: I18nConfig<C["lang"]>;
  translations?:
    | TranslationsAPI<C["lang"], { ui: Translations }>
    | SingularTranslationsAPI<{ ui: Translations }>;
  meta?: MetaConfig<NoInfer<C>>;
}

export interface Layouts<C extends ConfigContext = ConfigContext> {
  root: FC<{ lang?: string; children: ReactNode }> & { $ctx?: C };
  page: FC<{
    lang?: string;
    slugs: string[];
    page: C["loaderConfig"]["page"];
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

export interface ConfigBuilder<C extends ConfigContext> {
  /** for type inference only, always `undefined` */
  $context: C;
  get: () => Config<C> & {
    plugins: ServerPluginOption<C>[];
    layouts: Partial<Layouts<C>>;
    adapters: Adapter<C>[];
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

export function defineConfig<C extends LoaderConfig, L extends string = string>(
  config: Config<{
    loaderConfig: C;
    lang: L;
  }> = {},
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
  };
}
