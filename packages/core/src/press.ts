import type { ReactElement, ReactNode } from "react";
import type * as Framework from "fumadocs-core/framework/plugin";
import type * as PageTree from "fumadocs-core/page-tree";
import type { I18nConfig, SingularTranslationsAPI, TranslationsAPI } from "fumadocs-core/i18n";
import type { _Internal, LoaderOptions, SourceUnion } from "fumadocs-core/source";
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import type { RootProviderProps } from "fumadocs-ui/provider/base";
import type { Context } from "./context";
import type { GitProvider } from "./git";
import type { HeadEnv, HeadTag } from "./head";
import type {
  AppShape,
  Awaitable,
  CollectTypes,
  Declared,
  DocsPageData,
  LangEnv,
  MergedTypes,
  NamedSlot,
  Plugin,
  PluginOption,
  PluginTypes,
  PresetEntry,
  UnknownKeys,
  View,
} from "./plugin";

export type InferAppShape<
  I extends _Internal.AnyInput,
  Lang extends string | undefined,
  Runtime extends string,
> = {
  page: _Internal.GeneratePage<I>;
  meta: _Internal.GenerateMeta<I>;
  lang: Lang;
  source: I extends Record<infer K, SourceUnion> ? K : undefined;
  runtime: Runtime;
};

/** the i18n config of a site with the languages `Lang`, plugins for any site (`string | undefined`) get either */
export type InferI18nConfig<Lang extends string | undefined> = [Lang] extends [undefined]
  ? undefined
  : [Lang] extends [string]
    ? I18nConfig<Lang>
    : I18nConfig | undefined;

export interface SiteConfig {
  /** full URL of the site with the base path, like `https://example.com/docs`, for metadata like canonical URLs */
  baseUrl?: string;

  /**
   * `hreflang` values by language, for language codes that are not BCP 47 language tags.
   *
   * @example { cn: "zh-Hans" }
   */
  hreflang?: Record<string, string>;

  name?: string;

  git?: {
    /** @defaultValue "github" */
    provider?: GitProvider;
    /** base URL of a self-hosted instance, like `https://gitlab.example.com` */
    url?: string;
    /** the user or organisation (group on GitLab) that owns the repo */
    user: string;
    repo: string;
    branch: string;
    /** the root directory of the repo */
    rootDir?: string;
  };
}

/** the pages of the source key `K` */
export type SourcePage<C extends AppShape, K extends C["source"]> = Extract<C["page"], { type: K }>;

/** the options of the content stage: the site's languages and the Fumadocs loader */
export interface ContentOptions<I extends _Internal.AnyInput, Lang extends string | undefined> {
  i18n?: InferI18nConfig<Lang>;
  /** the Fumadocs `loader()` options; `baseUrl` is the site's, `i18n` the one above */
  loaderOptions?: Omit<
    LoaderOptions<_Internal.GenerateStorage<I>, InferI18nConfig<Lang>>,
    "baseUrl" | "i18n" | "plugins"
  > &
    Pick<Framework.PluginLoaderOptions, "plugins"> & {
      /** revalidate dynamic sources on each request, otherwise call `revalidateLoader()` @defaultValue false */
      alwaysRevalidate?: boolean;
    };
}

/** what press.config exports; helpers read the type-only `~types` of any stage: `RenderPageProps<typeof app>` */
export interface Press<C extends AppShape = AppShape, T extends PluginTypes = PluginTypes> {
  readonly "~types"?: { content: C; plugins: T };
  /** the stages as written, read by the runtime */
  readonly "~press": PressInput;
}

/**
 * The stages as written. `R` is the runtime's own `.config()` options: a runtime reads them from the module that
 * gives it press.config, typed with its `R`.
 */
export interface PressInput<R = {}> {
  readonly content: _Internal.AnyInput;
  readonly options: ContentOptions<_Internal.AnyInput, string | undefined>;
  readonly plugins: readonly PluginOption<Plugin<AppShape, any>>[];
  readonly config: PressConfig<AppShape, any> & R;
}

/** after `.plugins()`; `R` is the runtime's own `.config()` options */
export interface PressApp<C extends AppShape, T extends PluginTypes, R> extends Press<C, T> {
  config(config: PressConfig<C, T> & R): Press<C, T>;
}

/** the result of a runtime's `createPress(content, options)`; `.config()` directly is a site without plugins */
export interface PressContent<C extends AppShape, R> extends PressApp<C, MergedTypes<never>, R> {
  plugins<const P extends readonly PluginOption<Plugin<C, any>>[]>(
    this: [UnknownKeys<FlatArray<P, 20>, C>] extends [never]
      ? unknown
      : { "unknown plugin keys": UnknownKeys<FlatArray<P, 20>, C> },
    ...plugins: P | readonly PluginOption<Plugin<C, any>>[]
  ): PressApp<C, CollectTypes<P>, R>;
}

/** the options of `.config()` */
export interface PressConfig<C extends AppShape, T extends PluginTypes> {
  /** the default plugins: entries load after your plugins unless one provides their capability; `[]` for none @defaultValue recommendedPreset() */
  preset?: readonly PresetEntry<Plugin<C, any>>[];
  site?: Omit<SiteConfig, "baseUrl">;
  /** tags of every page, and of a page with `page` (or `route` and `path` on framework pages); yours win over the plugins' by key */
  head?: HeadTag[] | ((this: Context<C>, env: HeadEnv<C>) => Awaitable<HeadTag[] | undefined>);
  ui?: UIOptionsOf<C, T>;
}

export type PageNode = Exclude<ReactNode, undefined | PromiseLike<unknown>>;
export type BaseOptions = Omit<BaseLayoutProps, "children">;
export type ProviderProps = Omit<RootProviderProps, "children">;

interface UIOptionsOf<C extends AppShape, T extends PluginTypes> {
  /** Fumadocs `baseOptions(lang)`; links are written as served, `this.localizePath()` localizes them */
  baseOptions?: BaseOptions | ((this: Context<C>, env: LangEnv<C>) => Awaitable<BaseOptions>);
  /** `<RootProvider>` props; `search.SearchDialog` replaces the dialog of the search plugin and receives its `search.options` */
  providerProps?: ProviderProps | ((this: Context<C>, env: LangEnv<C>) => Awaitable<ProviderProps>);
  translations?:
    | ([C["lang"]] extends [undefined] ? never : TranslationsAPI<NonNullable<C["lang"]>, any>)
    | SingularTranslationsAPI<any>;
  /**
   * the UI of every page Fumapress renders: take `const { renderDefault } = props`, switch on `props.type`, and end with
   * `default: return renderDefault()` (once every type has a case, `props` is `never` in `default`)
   */
  renderPage?: (this: Context<C>, props: RenderPagePropsOf<C, T>) => Awaitable<PageNode>;
}

type RenderPageBase<C extends AppShape> = LangEnv<C> & {
  tree: PageTree.Root;
  /** `ui.baseOptions` with the plugins' contributions */
  baseOptions: BaseOptions;
  /** the built-in UI: the Docs Layout and page, or the plugin's content in the Home Layout */
  renderDefault(): PageNode;
};

/** a content page of the source key `K` */
export type ContentPageProps<
  K extends C["source"],
  C extends AppShape,
  T extends PluginTypes,
> = RenderPageBase<C> & {
  type: K;
  page: SourcePage<C, K>;
  slugs: string[];
  /** `getPageData()`: title, description, toc, full, lastModified, markdownUrl, githubUrl after `transformPage` */
  pageData: DocsPageData;
  /** the rendered content, with `body.wrapper` applied */
  body: ReactElement;
} & {
  [S in NamedSlot]: Partial<Record<Declared<T, S>, ReactElement>>;
} & (K extends keyof Declared<T, "pages">
    ? Declared<T, "pages">[K] & { children: ReactElement }
    : {});

/** a plugin view of type `K`; `children` is its content without a layout */
export type ViewPageProps<
  K extends keyof Declared<T, "views">,
  C extends AppShape,
  T extends PluginTypes,
> = RenderPageBase<C> & {
  type: K;
  children: ReactElement;
} & Declared<T, "views">[K];

export type PageType<C extends AppShape, T extends PluginTypes> =
  | C["source"]
  | (keyof Declared<T, "views"> & string);

export type RenderPagePropsOf<
  C extends AppShape,
  T extends PluginTypes,
  K extends PageType<C, T> = PageType<C, T>,
> = K extends C["source"]
  ? ContentPageProps<K, C, T>
  : K extends keyof Declared<T, "views">
    ? ViewPageProps<K, C, T>
    : never;

type TypesOfPress<A extends Press<any, any>> = NonNullable<A["~types"]>;

/** the page types of a site: its source keys and the view types of its plugins */
export type PressPageType<A extends Press<any, any>> = PageType<
  TypesOfPress<A>["content"],
  TypesOfPress<A>["plugins"]
>;

/** props of `ui.renderPage` in its own file: `RenderPageProps<typeof app, "docs">` */
export type RenderPageProps<
  A extends Press<any, any>,
  K extends PressPageType<A> = PressPageType<A>,
> = RenderPagePropsOf<TypesOfPress<A>["content"], TypesOfPress<A>["plugins"], K>;

/** the languages of a site, `undefined` without i18n */
export type PressLang<A extends Press<any, any>> = TypesOfPress<A>["content"]["lang"];

/** `this` of callbacks in their own files: `PressContext<typeof app>` */
export type PressContext<A extends Press<any, any>> = Context<TypesOfPress<A>["content"]>;

/** `ui` callbacks in their own files: `UIOptions<typeof app>["baseOptions"]` */
export type UIOptions<A extends Press<any, any>> = UIOptionsOf<
  TypesOfPress<A>["content"],
  TypesOfPress<A>["plugins"]
>;

/**
 * The content stage of a runtime's `createPress()`: the runtime passes its own `.config()` options as `R`.
 *
 * @example
 * ```ts
 * export function createPress<I extends _Internal.AnyInput, Lang extends string | undefined = undefined, C extends AppShape = InferAppShape<I, Lang, "waku">>(content: I, options?: ContentOptions<I, Lang>): PressContent<C, WakuPressConfig<C>> {
 *   return core.createPress(content, options);
 * }
 * ```
 */
export function createPress<
  I extends _Internal.AnyInput,
  Lang extends string | undefined,
  C extends AppShape,
  R,
>(content: I, options?: ContentOptions<I, Lang>): PressContent<C, R>;

export function createPress(
  content: _Internal.AnyInput,
  options: ContentOptions<_Internal.AnyInput, string | undefined> = {},
): PressContent<AppShape, {}> {
  function app(plugins: PressInput["plugins"]): PressApp<AppShape, any, {}> {
    return {
      "~press": { content, options, plugins, config: {} },
      config: (config) => ({ "~press": { content, options, plugins, config } }),
    };
  }

  return { ...app([]), plugins: (...plugins) => app(plugins) };
}

/** `renderPage` props of any site, as the runtime's `renderDefault` reads them */
export type DefaultPageProps = RenderPageBase<AppShape> & { type: string | undefined } & (
    | (Pick<
        ContentPageProps<AppShape["source"], AppShape, PluginTypes>,
        "page" | "slugs" | "pageData" | "body" | NamedSlot
      > & {
        /** the content of the plugin owning the page */
        children?: ReactElement;
      })
    | (Pick<ViewPageProps<never, AppShape, PluginTypes>, "children"> & { page?: undefined })
  );

/** what the runtime renders: a content page, or the view a plugin returned */
export type RenderTarget<C extends AppShape = AppShape> = LangEnv<C> &
  ({ page: C["page"]; view?: undefined } | { view: View<any>; path: string; page?: undefined });
