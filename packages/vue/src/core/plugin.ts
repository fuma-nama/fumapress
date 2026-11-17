import type { TranslationExtension } from "fumadocs-core/i18n";
import type {
  LoaderOptions as FumadocsLoaderOptions,
  LoaderPluginOption,
  Meta,
  Page,
} from "fumadocs-core/source";
import type { Context } from "./context";
import type { LayoutProps } from "./layouts";
import type {
  Awaitable,
  HeadTag,
  PageBody,
  PageData,
  StructuredData,
  TOCItem,
  View,
} from "./types";

/** the types of a site, inferred from its content */
export interface AppShape {
  page: Page;
  meta: Meta;
  /** the languages of the site: those of `i18n`, or `site.lang` alone, a `string` */
  lang: string;
  /** the source keys of a site with sources by key, `undefined` with one source */
  source: string | undefined;
  runtime: "vue";
}

/** the env of per-language options and hooks */
export interface LangEnv<C extends AppShape = AppShape> {
  lang: C["lang"];
}

/** a page of the site: a content page with `page`, otherwise a view or a custom page */
export interface PageEnv<C extends AppShape = AppShape> extends LangEnv<C> {
  /** its URL, without the base path */
  pathname: string;
  page?: C["page"];
}

/** the page a `<head>` is for, with the data of a content page or a view */
export interface HeadEnv<C extends AppShape = AppShape> extends PageEnv<C> {
  data?: PageData;
}

/**
 * What a plugin declares for types: the props of its views by type, and the props of the content pages it renders
 * as views, by source key (its `getPageBody` returns `{ view: { type: key, props } }`).
 */
export type PluginTypes = { views?: object; pages?: object };

/** the declarations `K` of plugin types: on a union, their union; on `any`, `any`; on the merged types of a site, its own */
export type Declared<T, K extends keyof PluginTypes> = T extends unknown
  ? K extends keyof T
    ? Exclude<T[K], undefined>
    : never
  : never;

type Intersect<U> = [U] extends [never]
  ? {}
  : (U extends unknown ? (u: U) => void : never) extends (u: infer I extends object) => void
    ? I
    : {};
type TypesOf<P> = P extends { readonly "~types"?: infer X } ? (P extends object ? X : {}) : {};

/** the plugin types of a site, `U` is the union of each plugin's; an interface, so it is cached and printed by name */
export interface MergedTypes<U> {
  views: Intersect<Declared<U, "views">>;
  pages: Intersect<Declared<U, "pages">>;
}

/** keys outside the plugin contract, like a removed or misspelled hook: `const P` skips the excess property check of literals */
export type UnknownKeys<E> = E extends readonly unknown[]
  ? never
  : E extends object
    ? Exclude<keyof E, keyof Plugin>
    : never;

/** no recursion over the list: `FlatArray` flattens nested lists by depth */
export type CollectTypes<P extends readonly unknown[]> =
  TypesOf<FlatArray<P, 20>> extends infer U ? MergedTypes<U> : never;

export type ApiHandler = (
  request: Request,
  env: { params: Record<string, string> },
) => Awaitable<Response>;

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";

/** the value of the param of a route: a string for `[name]`, a list of segments for `[...name]` */
export type StaticPath = string | string[];

export type ApiRoute = {
  /** without the base path; `[name]` matches a segment, `[...name]` the rest */
  path: string;
  /**
   * `static` routes are generated at build time from their `GET` handler, or from `data`. A route that reads content
   * sets `this.getContentRender()`, so it renders on demand when the content does.
   *
   * @defaultValue "static" for a data route, "dynamic" otherwise
   */
  render?: "static" | "dynamic";
  /** the values of the param of a `static` route, one generated file each */
  staticPaths?: StaticPath[] | (() => Awaitable<StaticPath[]>);
  /**
   * Makes the route a data route: its `GET` response is the JSON of the value, and the app loads it with `load()`,
   * on the server without a request. `undefined` is a 404.
   */
  data?: (env: { params: Record<string, string> }) => Awaitable<unknown>;
  /**
   * A data route with the same value on every page: the browser fetches it once, where the value of another data
   * route comes with the page that loaded it.
   */
  shared?: boolean;
  /** every method without a handler of its own */
  ALL?: ApiHandler;
} & Partial<Record<HttpMethod, ApiHandler>>;

/** the route of a view: its pages, outside the content. Its `path` has no language prefix: the site adds it. */
export interface ViewRouteOptions extends Pick<ApiRoute, "path" | "staticPaths"> {
  /**
   * `static` pages are generated at build time. A view that reads content sets `this.getContentRender()`, so it
   * renders on demand when the content does.
   *
   * @defaultValue "static"
   */
  render?: "static" | "dynamic";
  /** the data of its pages, like their title */
  data?: Partial<PageData>;
}

/** the env of the pages of a view: the params of its path, and its language */
export interface ViewEnv<Lang extends string = string> {
  params: Record<string, string>;
  lang: Lang;
}

/**
 * A view of a plugin: `view` gives what the theme renders, with the component of its `views` named `type`, one of the
 * views `V` the plugin declares.
 */
export interface ViewRoute<V = any, Lang extends string = string> extends ViewRouteOptions {
  /** the page at `params` in `lang`, none for a 404. Its `data` wins over the `data` of the route. */
  view(env: ViewEnv<Lang>): Awaitable<(View<V> & { data?: Partial<PageData> }) | undefined>;
}

/** what plugins create in `routes`, with the views `V` they declare */
export interface RouteFns<C extends AppShape = AppShape, V = any> {
  createApi(route: ApiRoute): void;
  /** a page of the plugin, in every language of the site, or in `lang` only */
  createView(route: ViewRoute<V, C["lang"]> & { lang?: C["lang"] }): void;
}

/** the output of a build */
export interface BuildOutput {
  /** write a file to the public output, `path` is relative to it */
  emitFile: (path: string, content: string | Uint8Array) => void;
  /** the paths generated from the pages and routes of the site, without the base path: not the files hooks emit */
  paths: string[];
  /** request a page of the built site */
  fetch: (request: Request) => Promise<Response>;
}

/**
 * The hooks that render the pages of a content source. A plugin returns `undefined` for a page it doesn't own, and the
 * first result wins. Only `getPageBody` is required to show a page.
 */
export interface ContentHooks<C extends AppShape = AppShape, T extends PluginTypes = {}> {
  /** the content of a page; a view is one of the `pages` the plugin declares, by the source key of the page */
  getPageBody?: (
    this: Context<C>,
    page: C["page"],
  ) => Awaitable<PageBody<Declared<T, "pages">> | undefined>;
  /** the table of contents */
  getPageToc?: (this: Context<C>, page: C["page"]) => Awaitable<TOCItem[] | undefined>;
  /** the page as Markdown, for `llms-full.txt` */
  getPageText?: (this: Context<C>, page: C["page"]) => Awaitable<string | undefined>;
  /** the headings and the text under each, for full text search */
  getPageStructuredData?: (
    this: Context<C>,
    page: C["page"],
  ) => Awaitable<StructuredData | undefined>;
  /** when the page last changed: for the sitemap, and `lastModified` of the page data, which the layout shows */
  getPageLastModified?: (this: Context<C>, page: C["page"]) => Awaitable<Date | undefined>;
}

/** options of the Fumadocs content loader a plugin adds, like its `plugins` */
export type LoaderOptions = Partial<Omit<FumadocsLoaderOptions, "baseUrl" | "i18n" | "plugins">> & {
  plugins?: LoaderPluginOption[];
};

/**
 * A plugin of Fumapress: an object with hooks, `this` is the {@link Context} of the site. Everything the site does
 * goes through these hooks, its built-in features too: they are plugins after yours.
 *
 * The hooks have the names and signatures of `@fumapress/core`, so server-side plugins port across runtimes. Where
 * plugins return options (`head`, `layoutProps`, `configureLoader`), the site's own win, then plugins in order.
 *
 * Hooks are properties, so `this` and pages are checked contravariantly: a plugin for any site fits every site. A plugin
 * is a generic factory typed by the site (`myPlugin<C extends AppShape>(options: MyOptions<NoInfer<C>>): Plugin<C, MyTypes>`).
 */
export interface Plugin<
  in C extends AppShape = AppShape,
  T extends PluginTypes = {},
> extends ContentHooks<C, T> {
  readonly "~types"?: T;
  name: string;
  /** the keys of the texts of its UI, which `ui.translations` of the site translates */
  translations?: TranslationExtension;
  /** runs before the content loader is created */
  init?: (this: Context<C>) => Awaitable<void>;
  /** adds options to the content loader, `plugins` of every plugin are combined */
  configureLoader?: (this: Context<C>) => Awaitable<LoaderOptions | undefined>;
  /** runs after the content loader is created */
  configure?: (this: Context<C>) => Awaitable<void>;
  /** the API routes and the pages of the plugin, called once */
  routes?: (this: Context<C>, fns: RouteFns<C, Declared<T, "views">>) => Awaitable<void>;
  /**
   * Adds to the data of a page sent to the browser: a content page with `env.page`, otherwise a view. A field the
   * page or an earlier plugin has set stays.
   */
  transformPage?: (
    this: Context<C>,
    data: Readonly<PageData>,
    env: PageEnv<C>,
  ) => Awaitable<Partial<PageData> | undefined>;
  head?: (this: Context<C>, env: HeadEnv<C>) => Awaitable<HeadTag[] | undefined>;
  /** the navbar and links of the layouts: the same on every page of a language, so the browser fetches them once */
  layoutProps?: (this: Context<C>, env: LangEnv<C>) => Awaitable<Partial<LayoutProps> | undefined>;
  /**
   * Runs first on every request the server receives. Call `next()` to continue, or `next(path)` to serve another path
   * instead. Requests a host serves from the files of the build never reach it.
   */
  middleware?: (
    this: Context<C>,
    request: Request,
    next: (rewrite?: string) => Promise<Response>,
  ) => Promise<Response>;
  /** runs once when the site is built, not on dev or production servers; throw to fail the build */
  build?: (this: Context<C>, output: BuildOutput) => Awaitable<void>;
}

/** a plugin `P` of `.plugins()`, lists are flattened and falsy values left out */
export type PluginOption<P extends Pick<Plugin, "name"> = Plugin> =
  | P
  | false
  | undefined
  | null
  | readonly PluginOption<P>[];

/** a plugin of the preset, loaded when the site starts */
export type PresetEntry<P extends Pick<Plugin, "name"> = AnyPlugin> = () => Awaitable<P>;

/** a plugin of any site, as the runtime holds it */
export type AnyPlugin = Plugin<AppShape, any>;

export function flatten(
  options: readonly PluginOption<AnyPlugin>[],
  out: AnyPlugin[] = [],
): AnyPlugin[] {
  for (const option of options) {
    if (Array.isArray(option)) flatten(option, out);
    else if (option) out.push(option as AnyPlugin);
  }
  return out;
}
