import type { I18nConfig, SingularTranslationsAPI, TranslationsAPI } from "fumadocs-core/i18n";
import type {
  _Internal,
  LoaderOptions,
  LoaderPluginOption,
  SourceUnion,
} from "fumadocs-core/source";
import type { Component } from "vue";
import type { Context } from "./context";
import type { LayoutProps } from "./layouts";
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
  PluginErrors,
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
export interface SiteView<C extends AppShape, Props> extends Omit<ViewRouteOptions, "data"> {
  /** the props of the page at `params` in `lang`, none for a 404 */
  view(this: Context<C>, env: ViewEnv<C["lang"]>): Awaitable<Props | undefined | void>;
  /**
   * The data of its pages, like their title: or of each page, from its `params` and `lang`. Data from what `view`
   * loaded is a view of a plugin, whose `view` returns it with the props.
   */
  data?:
    | Partial<PageData>
    | ((this: Context<C>, env: ViewEnv<C["lang"]>) => Awaitable<Partial<PageData> | undefined>);
}

/** a view of any site, as the runtime holds it */
export type AnySiteView = SiteView<AppShape, any>;

export interface UIOptions<C extends AppShape> {
  /**
   * The props every layout shares, like the links of the navbar: data, or a function of the language. Links are
   * written as served, `this.localizePath()` localizes them. They are sent to the browser, so every value is
   * serializable: the layout and its other props are in the theme.
   */
  layoutProps?:
    | LayoutProps
    | ((this: Context<C>, env: LangEnv<C>) => Awaitable<LayoutProps | undefined>);
  /**
   * The texts of the UI: `i18n.translations()` of `@fumapress/vue/i18n` on a site with languages, checked against
   * them, `defineTranslations()` otherwise. A key is the English text with its note, and `displayName` names a
   * language in the language switch.
   */
  translations?:
    | ([string] extends [C["lang"]] ? never : TranslationsAPI<C["lang"], any>)
    | SingularTranslationsAPI<any>;
}

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
  readonly views: Readonly<Record<string, AnySiteView>>;
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
  /** the views of the site by name, with the props of their component; a name is not the key of a source */
  views<P extends Record<string, object> & { [K in C["source"] & string]?: never }>(views: {
    [K in keyof P]: SiteView<C, P[K]>;
  }): PressApp<C, MergedTypes<T | { views: P }>>;
}

/** the result of `createPress(content, options)`; `.views()` or `.config()` directly is a site without plugins */
export interface PressContent<C extends AppShape> extends PressPlugins<C, MergedTypes<never>> {
  plugins<const P extends readonly PluginOption<Plugin<C, any>>[]>(
    this: PluginErrors<FlatArray<P, 20>>,
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

/** a content page of any site as the browser receives it, what a docs layout renders */
export interface ContentPage {
  /** its source key, none with one source */
  type?: string;
  url: string;
  /** the data of its file, as JSON: the validated frontmatter of a collection */
  data: object;
  /** `getPageData()`: its title, description and what plugins add */
  pageData: PageData;
  toc: TOCItem[];
  /** its content: compiled Markdown renders with the `components` of the theme */
  Content: Component;
}

/** a view of any site as the browser receives it */
export interface ViewPage {
  /** the name of the view */
  type: string;
  url: string;
  /** what `view` returned, as JSON */
  props: object;
  /** the `data` of the view: its title, description and what plugins add */
  pageData: PageData;
}

/** a content page of the source key `K` as the browser receives it */
export interface ContentPageOf<C extends AppShape, K extends C["source"]> extends ContentPage {
  type: K;
  data: Jsonify<SourcePage<C, K>["data"]>;
}

/** a view of type `K` as the browser receives it */
export interface ViewPageOf<V, K extends keyof V> {
  type: K;
  url: string;
  /** what `view` returned, as JSON */
  props: Jsonify<V[K]>;
  /** the `data` of the view: its title, description and what plugins add */
  pageData: PageData;
}

/** the source keys whose pages a plugin renders as views, by their `pages` */
export type ViewSourceOf<A extends Press<any, any>> = keyof Declared<PluginsOf<A>, "pages"> &
  ContentOf<A>["source"];

/**
 * What the browser receives for a page of the type `K` of a site: `PageOf<typeof app, "docs">`. The pages of a
 * source a plugin renders as views (its `pages`) have its `props` in place of `Content`.
 */
export type PageOf<
  A extends Press<any, any>,
  K extends PressPageType<A>,
> = K extends ContentOf<A>["source"]
  ? K extends ViewSourceOf<A>
    ? Omit<ContentPageOf<ContentOf<A>, K>, "Content"> & {
        props: Jsonify<Declared<PluginsOf<A>, "pages">[K]>;
      }
    : ContentPageOf<ContentOf<A>, K>
  : K extends keyof Declared<PluginsOf<A>, "views">
    ? ViewPageOf<Declared<PluginsOf<A>, "views">, K>
    : never;

/** the names of the views of a site, of `.views()` and of its plugins */
export type PressViewName<A extends Press<any, any>> = keyof Declared<PluginsOf<A>, "views"> &
  string;
