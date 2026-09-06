import { getPressContext, type AppContext } from "./app/context";
import type { _Internal, SourceUnion } from "fumadocs-core/source";
import type { Adapter, Awaitable, PressLoaderOptions } from "@/lib/types";
import type { I18nConfig, SingularTranslationsAPI, TranslationsAPI } from "fumadocs-core/i18n";
import type { FC, ReactNode } from "react";
import type { PressPluginOption } from "./app/plugin";
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import type { GitProvider } from "@/lib/git";

export type BuildMode = "static" | "dynamic" | "default";

type InferAppShape<
  I extends _Internal.AnyInput = _Internal.AnyInput,
  Lang extends string | undefined = string | undefined,
> = {
  page: _Internal.GeneratePage<I>;
  meta: _Internal.GenerateMeta<I>;
  lang: Lang;
  /** source names in multi-source setup */
  source: I extends Record<infer K, SourceUnion> ? K : undefined;
};

export interface FumapressConfig<
  I extends _Internal.AnyInput = _Internal.AnyInput,
  Lang extends string | undefined = string | undefined,
> {
  /**
   * - `static`: always prefer static, including search etc.
   * - `dynamic`: always prefer dynamic.
   * - `default`: only certain parts like search routes are dynamic.
   */
  mode?: BuildMode;
  site?: SiteConfig;

  /**
   * - `recommended`: add recommended plugins automatically: sitemap, robots.txt, llms.txt, Takumi (OG image), RSS, and search (Flexsearch). Plugins specified in `plugins` take priority.
   * - `false`: do not add any plugins.
   *
   * @default "recommended"
   */
  preset?: "recommended" | false;

  /** The content sources */
  content: I;

  meta?: {
    /** render meta tags for any pages */
    root?: (this: AppContext<InferAppShape<I, Lang>>) => ReactNode;

    /** render meta tags for page */
    page?: (
      this: AppContext<InferAppShape<I, Lang>>,
      page: InferAppShape<I, Lang>["page"],
    ) => ReactNode;
  };

  /** Base props for Fumadocs UI layouts */
  defaultLayoutProps?:
    | Omit<BaseLayoutProps, "children">
    | ((
        this: AppContext<InferAppShape<I, Lang>>,
        env: { lang: string | undefined },
      ) => Awaitable<Omit<BaseLayoutProps, "children">>);

  renderRoot?: (
    this: AppContext<InferAppShape<I, Lang>>,
    opts: { lang?: string; children: ReactNode },
  ) => ReactNode;

  renderPage?: (
    this: AppContext<InferAppShape<I, Lang>>,
    opts: { lang?: string; slugs: string[]; page: InferAppShape<I, Lang>["page"] },
  ) => ReactNode;

  renderNotFound?: (this: AppContext<InferAppShape<I, Lang>>, opts: { lang?: string }) => ReactNode;

  adapters?: Adapter<InferAppShape<I, Lang>>[];
  plugins?: PressPluginOption<InferAppShape<I, Lang>>[];

  /** i18n config for core, optional when `translations` is specified */
  i18n?: [Lang] extends [string] ? I18nConfig<Lang> : undefined;

  translations?:
    | ([Lang] extends [string] ? TranslationsAPI<Lang, any> : never)
    | SingularTranslationsAPI<any>;

  /** Options for Fumadocs Loader API */
  loaderOptions?: Omit<
    PressLoaderOptions<
      _Internal.GenerateStorage<I>,
      [Lang] extends [string] ? I18nConfig<Lang> : undefined
    >,
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

export interface SiteConfig {
  /** full URL of app, used for metadata generation*/
  baseUrl?: string;

  /**
   * Trailing slash of generated page URLs (canonical, sitemap, RSS), match how your host serves pages:
   * `true` appends one, `false` strips it. Unset leaves URLs as generated.
   */
  trailingSlash?: boolean;

  /**
   * `hreflang` values by locale, for locale codes that are not BCP 47 language tags.
   *
   * @example { cn: "zh-Hans" }
   */
  hreflang?: Record<string, string>;

  name?: string;
  git?: {
    /**
     * The git hosting provider of your repository.
     *
     * @default "github"
     */
    provider?: GitProvider;

    /**
     * base URL of the git instance, needed for self-hosted instances (e.g. `https://gitlab.example.com`).
     *
     * @default the official instance of `provider`
     */
    url?: string;

    /** the user/organisation (or group on GitLab) that owns the repo */
    user: string;
    repo: string;
    branch: string;

    /** the root directory of git repo */
    rootDir?: string;
  };
}

export interface ConfigUtils<
  I extends _Internal.AnyInput = _Internal.AnyInput,
  Lang extends string | undefined = string | undefined,
> {
  /** for type inference only, always `undefined` */
  $context: InferAppShape<I, Lang>;
  get: () => FumapressConfig<I, Lang>;

  utils: () => {
    getPressContext: () => AppContext<InferAppShape<I, Lang>>;
  };

  /** @deprecated use top-level `renderRoot`, `renderPage`, and `renderNotFound` instead */
  layouts: (options: {
    root?: FC<{ lang?: string; children: ReactNode }>;
    page?: FC<{
      lang?: string;
      slugs: string[];
      page: InferAppShape<I, Lang>["page"];
    }>;
    notFound?: FC<{ lang?: string }>;

    /**
     * Define default props for all Fumadocs layouts, will be deep-merged with current props.
     */
    defaultProps?: (
      this: AppContext<InferAppShape<I, Lang>>,
      env: { lang: string | undefined },
    ) => Awaitable<Omit<BaseLayoutProps, "children">>;
  }) => ConfigUtils<I, Lang>;
  plugins: (...plugins: PressPluginOption<InferAppShape<I, Lang>>[]) => ConfigUtils<I, Lang>;
  adapters: (...adapters: Adapter<InferAppShape<I, Lang>>[]) => ConfigUtils<I, Lang>;
}

export function defineConfig<
  I extends _Internal.AnyInput,
  Lang extends string | undefined = undefined,
>(config: FumapressConfig<I, Lang>): ConfigUtils<I, Lang> {
  return {
    $context: undefined as never,
    get() {
      return config;
    },
    utils() {
      return {
        getPressContext() {
          return getPressContext<InferAppShape<I, Lang>>();
        },
      };
    },
    layouts({ defaultProps, notFound: NotFound, page: Page, root: Root }) {
      if (defaultProps) config.defaultLayoutProps = defaultProps;
      if (NotFound) config.renderNotFound = (props) => <NotFound {...props} />;
      if (Page) config.renderPage = (props) => <Page {...props} />;
      if (Root) config.renderRoot = (props) => <Root {...props} />;
      return this;
    },
    plugins(...plugins) {
      config.plugins ??= [];
      config.plugins.push(...plugins);
      return this;
    },
    adapters(...adapters) {
      config.adapters ??= [];
      config.adapters.push(...adapters);
      return this;
    },
  };
}
