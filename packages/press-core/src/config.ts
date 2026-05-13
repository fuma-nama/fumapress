import type { AppContext } from "./lib/shared";
import type { LoaderConfig, LoaderOutput } from "fumadocs-core/source";
import type { Awaitable, ServerPlugin, Adapter } from "@/lib/types";
import type { TranslationsOption } from "fumadocs-ui/contexts/i18n";
import type { I18nConfig as CoreI18nConfig } from "fumadocs-core/i18n";
import type { ReactNode } from "react";

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
  plugins?: ServerPlugin[] | ((ctx: AppContext<C>) => ServerPlugin<C>[]);
  /** adapter for content sources, use `fumadocs-mdx` if not specified */
  adapters?: Adapter[] | ((ctx: AppContext<C>) => Adapter<C>[]);

  i18n?: I18nConfig<C["lang"]>;

  meta?: {
    /** render meta tags for any pages */
    root?: (this: AppContext<C>) => ReactNode;

    /** render meta tags for page */
    page?: (this: AppContext<C>, page: C["loaderConfig"]["page"]) => ReactNode;
  };
}

export interface I18nConfig<Lang extends string = string> {
  /** locale code -> language info */
  languages: {
    [K in Lang]: {
      displayName: string;
      translations?: TranslationsOption;
    };
  };
  defaultLanguage: NoInfer<Lang>;
}

/** convert Fumapress i18n config to core i18n config */
export function coreI18n<Lang extends string>(i18n: I18nConfig<Lang>): CoreI18nConfig<Lang> {
  return {
    defaultLanguage: i18n.defaultLanguage,
    languages: Object.keys(i18n.languages) as Lang[],
  };
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

export function defineConfig<C extends LoaderConfig, L extends string = string>(
  config: Config<{
    loaderConfig: C;
    lang: L;
  }>,
): Config<{ loaderConfig: C; lang: L }> {
  return config;
}

export function defineI18nConfig<Lang extends string>(config: I18nConfig<Lang>): I18nConfig<Lang> {
  return config;
}
