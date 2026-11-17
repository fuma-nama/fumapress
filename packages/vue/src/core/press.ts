import type { I18nConfig, SingularTranslationsAPI, TranslationsAPI } from "fumadocs-core/i18n";
import type {
  _Internal,
  LoaderOptions,
  LoaderPluginOption,
  SourceUnion,
} from "fumadocs-core/source";
import type { Component } from "vue";
import type { Context } from "./context";
import type { DefaultLayouts, LayoutName } from "./layouts";
import type {
  AnyPlugin,
  AppShape,
  CollectTypes,
  Declared,
  HeadEnv,
  LangEnv,
  MergedTypes,
  Plugin,
  PluginOption,
  PluginTypes,
  PresetEntry,
  UnknownKeys,
  ViewEnv,
  ViewRouteOptions,
} from "./plugin";
import type { Awaitable, HeadTag, Jsonify, PageData, SiteConfig, TOCItem } from "./types";

/** one source, or sources by key: each key is the `type` of its pages */
export type ContentInput = _Internal.AnyInput;

/** the types of the site of `content` with the languages `Lang` */
export type InferAppShape<I extends ContentInput, Lang extends string | undefined> = {
  page: _Internal.GeneratePage<I>;
  meta: _Internal.GenerateMeta<I>;
  // a site without `i18n` has one language, `site.lang`
  lang: Lang extends string ? Lang : string;
  source: I extends Record<infer K, SourceUnion> ? K : undefined;
  runtime: "vue";
};

/** the pages of the source key `K` */
export type SourcePage<C extends AppShape, K extends C["source"]> = Extract<C["page"], { type: K }>;

/** the i18n config of a site with the languages `Lang` */
export type InferI18nConfig<Lang extends string | undefined> = [Lang] extends [undefined]
  ? undefined
  : [Lang] extends [string]
    ? I18nConfig<Lang>
    : I18nConfig | undefined;

/**
 * The options of the content stage: the site's languages, and the Fumadocs `loader()` options like `url` and `slugs`.
 * `baseUrl` is the site's, and `loaderPlugins` is the `plugins` of `loader()`.
 */
export type ContentOptions<I extends ContentInput, Lang extends string | undefined> = Omit<
  LoaderOptions<_Internal.GenerateStorage<I>, InferI18nConfig<Lang>>,
  "baseUrl" | "i18n" | "plugins"
> & {
  /** the languages of the site: its pages, page trees and URLs are per language */
  i18n?: InferI18nConfig<Lang>;
  /** the `plugins` of the Fumadocs content loader, like `lucideIconsPlugin()` */
  loaderPlugins?: LoaderPluginOption[];
};

/**
 * A view of the site, `.views()`: a page outside the content, which the component of `views` of the theme named after
 * its key renders with the props `view` returns.
 */
export interface SiteView<C extends AppShape, Props> extends ViewRouteOptions {
  /** the props of the page at `params` in `lang`, none for a 404 */
  view(this: Context<C>, env: ViewEnv<C["lang"]>): Awaitable<Props | undefined | void>;
}

/** the props of the layout and of its page: data, or a function of the language */
export type LayoutOption<C extends AppShape, Props> =
  | Props
  | ((this: Context<C>, env: LangEnv<C>) => Awaitable<Props | undefined>);

/**
 * The layout of the content pages and its props. They are sent to the browser, so every value is serializable:
 * components belong in the theme.
 */
export type LayoutOptions<C extends AppShape> = {
  [K in LayoutName]: (K extends "docs" ? { layout?: K } : { layout: K }) & {
    /** the props of the layout; links are written as served, `this.localizePath()` localizes them */
    layoutProps?: LayoutOption<C, DefaultLayouts[K]["layout"]>;
    /** the props of the page of the layout */
    pageProps?: LayoutOption<C, DefaultLayouts[K]["page"]>;
  };
}[LayoutName];

export type UIOptions<C extends AppShape> = LayoutOptions<C> & {
  /**
   * The texts of the UI: `i18n.translations()` of `@fumapress/vue/i18n` on a site with languages, checked against
   * them, `defineTranslations()` otherwise. A key is the English text with its note, and `displayName` names a
   * language in the language switch.
   */
  translations?:
    | ([string] extends [C["lang"]] ? never : TranslationsAPI<C["lang"], any>)
    | SingularTranslationsAPI<any>;
};

/** the options of `.config()` */
export interface PressConfig<C extends AppShape = AppShape> {
  /** the default plugins, loaded after your plugins; `[]` for none @defaultValue recommendedPreset() */
  preset?: readonly PresetEntry<Plugin<C, any>>[];
  site?: SiteConfig;
  /** tags of every page, and of a page with `page`; yours win over the plugins' by key */
  head?: HeadTag[] | ((this: Context<C>, env: HeadEnv<C>) => Awaitable<HeadTag[] | undefined>);
  ui?: UIOptions<C>;
}

/** the stages as written, read by the runtime */
export interface PressInput {
  readonly content: ContentInput;
  readonly options: ContentOptions<ContentInput, string | undefined>;
  readonly plugins: readonly PluginOption<AnyPlugin>[];
  readonly views: Readonly<Record<string, SiteView<AppShape, object>>>;
  readonly config: PressConfig<AppShape>;
}

/** what `press.config` exports; helpers read the type-only `~types` of any stage: `PageOf<typeof app, "docs">` */
export interface Press<C extends AppShape = AppShape, T extends PluginTypes = PluginTypes> {
  readonly "~types"?: { content: C; plugins: T };
  readonly "~press": PressInput;
}

/** after `.views()` */
export interface PressApp<C extends AppShape, T extends PluginTypes> extends Press<C, T> {
  config(config: PressConfig<C>): Press<C, T>;
}

/** after `.plugins()`; `.config()` directly is a site without views of its own */
export interface PressPlugins<C extends AppShape, T extends PluginTypes> extends PressApp<C, T> {
  /** the views of the site by name, with the props of their component */
  views<P extends Record<string, object>>(views: {
    [K in keyof P]: SiteView<C, P[K]>;
  }): PressApp<C, MergedTypes<T | { views: P }>>;
}

/** the result of `createPress(content, options)`; `.views()` or `.config()` directly is a site without plugins */
export interface PressContent<C extends AppShape> extends PressPlugins<C, MergedTypes<never>> {
  plugins<const P extends readonly PluginOption<Plugin<C, any>>[]>(
    this: [UnknownKeys<FlatArray<P, 20>>] extends [never]
      ? unknown
      : { "unknown plugin keys": UnknownKeys<FlatArray<P, 20>> },
    ...plugins: P | readonly PluginOption<Plugin<C, any>>[]
  ): PressPlugins<C, CollectTypes<P>>;
}

/** the site of `press.config`: `createPress(content).plugins(...).views({...}).config({...})` */
export function createPress<
  I extends ContentInput,
  Lang extends string | undefined = undefined,
  C extends AppShape = InferAppShape<I, Lang>,
>(content: I, options?: ContentOptions<I, Lang>): PressContent<C>;

export function createPress(
  content: ContentInput,
  options: ContentOptions<ContentInput, string | undefined> = {},
): PressContent<AppShape> {
  const stage = (input: Omit<PressInput, "content" | "options">): PressApp<AppShape, any> => ({
    "~press": { content, options, ...input },
    config: (config) => ({ "~press": { content, options, ...input, config } }),
  });
  const plugins = (list: PressInput["plugins"]): PressPlugins<AppShape, any> => ({
    ...stage({ plugins: list, views: {}, config: {} }),
    views: (views) => stage({ plugins: list, views, config: {} }),
  });

  return { ...plugins([]), plugins: (...list) => plugins(list) };
}

type TypesOfPress<A extends Press<any, any>> = NonNullable<A["~types"]>;
type ContentOf<A extends Press<any, any>> = TypesOfPress<A>["content"];
type PluginsOf<A extends Press<any, any>> = TypesOfPress<A>["plugins"];

/** the page types of a site: its source keys, and the names of its views and of those of its plugins */
export type PressPageType<A extends Press<any, any>> =
  | ContentOf<A>["source"]
  | (keyof Declared<PluginsOf<A>, "views"> & string);

/** the languages of a site, a `string` without i18n */
export type PressLang<A extends Press<any, any>> = ContentOf<A>["lang"];

/** `this` of callbacks in their own files: `PressContext<typeof app>` */
export type PressContext<A extends Press<any, any>> = Context<ContentOf<A>>;

/** a content page of the source key `K` as the browser receives it */
export interface ContentPageOf<C extends AppShape, K extends C["source"]> {
  type: K;
  url: string;
  /** the data of its file, as JSON: the frontmatter of a collection */
  data: Jsonify<SourcePage<C, K>["data"]>;
  toc: TOCItem[];
  /** its content */
  Content: Component;
}

/** a view of type `K` as the browser receives it */
export interface ViewPageOf<V, K extends keyof V> {
  type: K;
  /** what `view` returned, as JSON */
  props: Jsonify<V[K]>;
  data: PageData;
}

/**
 * What the browser receives for a page of the type `K` of a site: `PageOf<typeof app, "docs">`. A content page of a
 * source a plugin renders as a view (its `pages`) has its `props` too.
 */
export type PageOf<
  A extends Press<any, any>,
  K extends PressPageType<A>,
> = K extends ContentOf<A>["source"]
  ? ContentPageOf<ContentOf<A>, K> &
      (K extends keyof Declared<PluginsOf<A>, "pages">
        ? { props: Jsonify<Declared<PluginsOf<A>, "pages">[K]> }
        : {})
  : K extends keyof Declared<PluginsOf<A>, "views">
    ? ViewPageOf<Declared<PluginsOf<A>, "views">, K>
    : never;
